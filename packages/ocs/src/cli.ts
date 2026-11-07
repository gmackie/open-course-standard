#!/usr/bin/env node
// The `ocs` command-line tool: validate, inspect, lock, verify, compose and export OCS 1.1
// packages. Reads local files only. It never executes package content or fetches anything.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { readActivityExport } from "./activity-export.ts";
import { OCS_BUNDLE_FORMAT, openBundle, planBundleInstall } from "./bundle.ts";
import { type ComposedCourse, composeCourse } from "./composer.ts";
import { OcsError, OcsFailure } from "./errors.ts";
import { resolveActivityExports } from "./install-plan.ts";
import { formatJson } from "./json.ts";
import { keyIdFor } from "./keys.ts";
import { InMemoryPackageLibrary } from "./library.ts";
import { type ConformanceRequest, runConformanceCase } from "./node/conformance.ts";
import { DirectoryStore, isPackageDirectory, readPackageDirectory } from "./node/store.ts";
import { writeZip } from "./node/zip.ts";
import { LOCK_PATH, type OcsPackage, readPackage } from "./package.ts";
import { type PackageSource, type Resolution, resolveCourse, serializeLock } from "./resolver.ts";
import { isPortable, OcsLock } from "./schema.ts";
import { PublisherKeys, PublisherTrust } from "./signatures.ts";
import { cartridgeFromOcs } from "./thin-cc.ts";

const VERSION = "1.1.0";

const USAGE = `ocs ${VERSION}: the Open Course Standard (OCS) 1.1 reference tool

Usage:
  ocs validate <path>... [--store <dir>] [--trust <file>]... [--json]
      Validate package directories, package store directories, activity exports, bundles,
      publisher key documents and lockfiles. A package's modules are resolved against --store
      (a store directory is its own store), and its ocs.lock must be current.
  ocs inspect <package-dir> [--store <dir>] [--json]
      Show a package's identity, digest, modules and composed outline.
  ocs lock <package-dir> [--store <dir>] [--check] [--update [<module>...]]
      Resolve the modules and write ocs.lock. Locked versions are kept while they still fit;
      --update lets the named modules (all, if none are named) move. --check writes nothing and
      fails if ocs.lock is not byte-identical to the result.
  ocs verify <bundle.json | store-dir | package-dir> [--trust <file>]... [--local-domain <domain>]...
             [--at <time>] [--store <dir>]
      Bundle: check every digest and publisher signature against the trusted keys, then plan the
      installation from the bundle alone. Store: verify every bundle under bundles/ against the
      store's publisher keys. Package: check that every locked package still has its locked digest.
  ocs compose <package-dir> [--store <dir>]
      Print the composed course as JSON, from the package's lockfile when it has one.
  ocs export-thin-cc <package-dir> --out <file.imscc | dir> [--locators <file.json>]
      Export the package's own units as a Thin Common Cartridge 1.3. --locators maps resource
      release IDs ("rsc_x" or "rsc_x@1.0.0") to public URLs.

  ocs conformance-adapter
      Answer one conformance suite request (JSON on stdin) for conformance/run.mjs.

Trust files are publisher key documents ({ "domain", "keys" }) or trust configurations
({ "localDomains", "publishers" }). Exit status: 0 on success, 1 on a failed check, 2 on misuse.`;

class UsageError extends Error {}

interface Report {
  path: string;
  kind: "package" | "store" | "export" | "bundle" | "publisher" | "lock";
  ok: boolean;
  id?: string;
  version?: string;
  digest?: string;
  problems: string[];
  notes: string[];
}

/** The messages an error carries: every package or export issue, or the error's message. */
function messages(error: unknown): string[] {
  if (error instanceof OcsError) {
    const { problem } = error;
    if (problem.kind === "invalid-package" || problem.kind === "invalid-export") {
      return problem.issues.map((issue) => `${problem.kind}: ${issue.path === "" ? "" : `${issue.path}: `}${issue.message}`);
    }
    return [`${problem.kind}: ${error.message}`];
  }
  if (error instanceof OcsFailure) return [`${error.code}: ${error.message}`];
  if (error instanceof SyntaxError) return [`not valid JSON: ${error.message}`];
  if (error instanceof Error && error.name === "ZodError") return [`invalid: ${error.message}`];
  return [error instanceof Error ? error.message : String(error)];
}

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

/** Loads trust files: publisher key documents and trust configurations, merged. */
function loadTrust(paths: readonly string[], localDomains: readonly string[], base?: PublisherTrust): PublisherTrust {
  const trust: PublisherTrust = { localDomains: [...(base?.localDomains ?? []), ...localDomains], publishers: [...(base?.publishers ?? [])] };
  for (const path of paths) {
    const value = readJson(path) as Record<string, unknown>;
    if ("publishers" in value) {
      const config = PublisherTrust.parse(value);
      trust.localDomains.push(...config.localDomains);
      trust.publishers.push(...config.publishers);
    } else trust.publishers.push(PublisherKeys.parse(value));
  }
  return trust;
}

const EMPTY: PackageSource = new InMemoryPackageLibrary();

/** Resolves a package, keeping its own lockfile's versions where they fit. */
async function resolvePackage(pkg: OcsPackage, store: PackageSource | undefined, update?: "all" | readonly string[]): Promise<Resolution> {
  let locked = pkg.lock;
  if (locked !== undefined && update !== undefined) {
    const moving = update === "all" ? undefined : new Set(pkg.manifest.modules.filter((m) => update.includes(m.name)).map((m) => m.package));
    locked = moving === undefined ? undefined : { ...locked, packages: locked.packages.filter((entry) => !moving.has(entry.id)) };
  }
  return resolveCourse(pkg, store ?? EMPTY, { locked });
}

async function checkPackage(dir: string, store: DirectoryStore | undefined): Promise<Report> {
  const report: Report = { path: dir, kind: "package", ok: false, problems: [], notes: [] };
  const files = readPackageDirectory(dir);
  let pkg: OcsPackage;
  try {
    pkg = await readPackage(files);
  } catch (error) {
    report.problems.push(...messages(error));
    return report;
  }
  Object.assign(report, { id: pkg.manifest.id, version: pkg.manifest.version, digest: pkg.digest });
  if (pkg.manifest.modules.length > 0 && store === undefined) {
    report.notes.push("modules not resolved: pass --store to resolve them and check ocs.lock");
    report.ok = true;
    return report;
  }
  try {
    const resolution = await resolvePackage(pkg, store);
    const lockText = serializeLock(resolution.lock);
    if (files[LOCK_PATH] === undefined) report.notes.push("no ocs.lock: run `ocs lock` before publishing");
    else if (files[LOCK_PATH] !== lockText) report.problems.push("ocs.lock is not the lockfile these packages resolve to: run `ocs lock`");
    const course = composeCourse(resolution);
    const portable = course.units.some((unit) => unit.items.some((item) => item.kind === "activity" && isPortable(item.activity.definition)));
    if (portable && store !== undefined) await resolveActivityExports(course, store);
    else if (portable) report.notes.push("portable activities not checked: pass --store to check their exports");
  } catch (error) {
    report.problems.push(...messages(error));
  }
  report.ok = report.problems.length === 0;
  return report;
}

async function checkExport(path: string, expectedId?: string): Promise<Report> {
  const report: Report = { path, kind: "export", ok: false, problems: [], notes: [] };
  try {
    const parsed = await readActivityExport(readFileSync(path, "utf8"));
    Object.assign(report, { id: parsed.export.id, version: parsed.export.version, digest: parsed.digest });
    if (expectedId !== undefined && parsed.export.id !== expectedId) report.problems.push(`holds ${parsed.export.id}, but its location says ${expectedId}`);
  } catch (error) {
    report.problems.push(...messages(error));
  }
  report.ok = report.problems.length === 0;
  return report;
}

async function checkPublisher(path: string, expectedDomain?: string): Promise<Report> {
  const report: Report = { path, kind: "publisher", ok: false, problems: [], notes: [] };
  try {
    const keys = PublisherKeys.parse(readJson(path));
    report.id = keys.domain;
    if (expectedDomain !== undefined && keys.domain !== expectedDomain) report.problems.push(`names ${keys.domain}, but its directory is ${expectedDomain}`);
    for (const key of keys.keys) {
      if ((await keyIdFor(key.publicKey)) !== key.keyId) report.problems.push(`key ${key.keyId} is not the key ID of its public key`);
    }
  } catch (error) {
    report.problems.push(...messages(error));
  }
  report.ok = report.problems.length === 0;
  return report;
}

async function checkBundle(path: string, trust: PublisherTrust | undefined, now: Date): Promise<Report> {
  const report: Report = { path, kind: "bundle", ok: false, problems: [], notes: [] };
  try {
    const value = readJson(path) as { packages?: { id?: string }[]; exports?: { id?: string }[] };
    let effective = trust;
    if (effective === undefined) {
      // Without trust, check everything but the signatures, by treating every domain as local.
      const domains = [...(value.packages ?? []), ...(value.exports ?? [])].flatMap((part) => (typeof part.id === "string" ? [part.id.slice(0, part.id.indexOf("/"))] : []));
      effective = { localDomains: [...new Set(domains)].slice(0, 20), publishers: [] };
      report.notes.push("signatures not checked: pass --trust (or validate the store that holds the bundle)");
    }
    const opened = await openBundle(value, effective, now);
    Object.assign(report, { id: opened.course.id, version: opened.course.version, digest: opened.course.digest });
    const plan = await planBundleInstall(opened);
    const signed = [...opened.signed.values()].filter(Boolean).length;
    report.notes.push(`${opened.signed.size} parts, ${signed} signed; installs ${plan.units.length} units and imports ${plan.imports.length} activities`);
  } catch (error) {
    report.problems.push(...messages(error));
  }
  report.ok = report.problems.length === 0;
  return report;
}

function checkLockFile(path: string): Report {
  const report: Report = { path, kind: "lock", ok: false, problems: [], notes: [] };
  try {
    const text = readFileSync(path, "utf8");
    const lock = OcsLock.parse(JSON.parse(text));
    Object.assign(report, { id: lock.root.id, version: lock.root.version });
    if (serializeLock(lock) !== text) report.problems.push("is not in the canonical lockfile form");
  } catch (error) {
    report.problems.push(...messages(error));
  }
  report.ok = report.problems.length === 0;
  return report;
}

function* walkFiles(dir: string): Generator<string> {
  for (const name of (existsSync(dir) ? readdirSyncSorted(dir) : [])) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walkFiles(path);
    else if (name.endsWith(".json")) yield path;
  }
}

function readdirSyncSorted(dir: string): string[] {
  return readdirSync(dir).filter((name) => name !== ".DS_Store").toSorted();
}

async function checkStore(root: string, trust: PublisherTrust | undefined, now: Date): Promise<Report[]> {
  const store = new DirectoryStore(root);
  const summary: Report = { path: root, kind: "store", ok: true, problems: store.unexpected.map((path) => `${path}: not part of the package store layout`), notes: [] };
  const reports: Report[] = [summary];
  for (const path of store.publisherFiles) reports.push(await checkPublisher(path, basename(dirname(path))));
  for (const { path, id } of store.exports.values()) reports.push(await checkExport(path, id));
  for (const stored of store.allPackages()) {
    const report = await checkPackage(stored.dir, store);
    if (report.id !== undefined && report.id !== stored.id) report.problems.push(`holds ${report.id}, but its directory says ${stored.id}`);
    if (report.version !== undefined && report.version !== stored.version) report.problems.push(`holds version ${report.version}, but its directory says ${stored.version}`);
    report.ok = report.problems.length === 0;
    reports.push(report);
  }
  let storeTrust: PublisherTrust | undefined;
  try {
    storeTrust = loadTrust([], [], store.trust());
  } catch (error) {
    summary.problems.push(...messages(error));
  }
  const bundleTrust = trust ?? storeTrust;
  for (const path of walkFiles(join(root, "bundles"))) reports.push(await checkBundle(path, bundleTrust, now));
  summary.notes.push(`${store.allPackages().length} packages, ${store.exports.size} activity exports, ${store.publisherFiles.length} publisher key documents`);
  summary.ok = summary.problems.length === 0;
  return reports;
}

async function validatePath(path: string, options: { store: DirectoryStore | undefined; trust: PublisherTrust | undefined; now: Date }): Promise<Report[]> {
  if (!existsSync(path)) return [{ path, kind: "package", ok: false, problems: ["does not exist"], notes: [] }];
  if (statSync(path).isDirectory()) {
    if (isPackageDirectory(path)) return [await checkPackage(path, options.store)];
    return checkStore(path, options.trust, options.now);
  }
  if (basename(path) === LOCK_PATH) return [checkLockFile(path)];
  let value: unknown;
  try {
    value = readJson(path);
  } catch (error) {
    return [{ path, kind: "export", ok: false, problems: messages(error), notes: [] }];
  }
  const object = (value ?? {}) as Record<string, unknown>;
  if (object.format === OCS_BUNDLE_FORMAT) return [await checkBundle(path, options.trust, options.now)];
  if ("activity" in object) return [await checkExport(path)];
  if ("domain" in object && "keys" in object) return [await checkPublisher(path)];
  return [{ path, kind: "export", ok: false, problems: ["is not an OCS document this tool recognizes"], notes: [] }];
}

function printReports(reports: readonly Report[], json: boolean): boolean {
  const ok = reports.every((report) => report.ok);
  if (json) {
    process.stdout.write(formatJson({ ok, reports }));
    return ok;
  }
  for (const report of reports) {
    const what = report.id === undefined ? report.kind : `${report.kind} ${report.id}${report.version === undefined ? "" : `@${report.version}`}`;
    process.stdout.write(`${report.ok ? "ok  " : "FAIL"} ${report.path}: ${what}${report.digest === undefined ? "" : ` ${report.digest}`}\n`);
    for (const problem of report.problems) process.stdout.write(`       ${problem}\n`);
    for (const note of report.notes) process.stdout.write(`       note: ${note}\n`);
  }
  const failed = reports.filter((report) => !report.ok).length;
  process.stdout.write(`${reports.length} checked, ${failed} failed\n`);
  return ok;
}

function packageDir(positionals: readonly string[]): string {
  const dir = positionals[0];
  if (dir === undefined || positionals.length > 1) throw new UsageError("expected one package directory");
  if (!isPackageDirectory(dir)) throw new UsageError(`${dir} is not a package directory (it has no ocs.json)`);
  return resolve(dir);
}

const storeOf = (path: string | undefined): DirectoryStore | undefined => (path === undefined ? undefined : new DirectoryStore(resolve(path)));

async function compose(dir: string, store: DirectoryStore | undefined): Promise<{ pkg: OcsPackage; resolution: Resolution; course: ComposedCourse }> {
  const pkg = await readPackage(readPackageDirectory(dir));
  const resolution = await resolvePackage(pkg, store);
  return { pkg, resolution, course: composeCourse(resolution) };
}

async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (command === undefined || command === "--help" || command === "-h" || command === "help") {
    process.stdout.write(`${USAGE}\n`);
    return command === undefined ? 2 : 0;
  }
  if (command === "--version" || command === "-v") {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (command === "conformance-adapter") {
    // The conformance runner's protocol (conformance/README.md): one request on stdin, one response on stdout.
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    const request = JSON.parse(Buffer.concat(chunks).toString("utf8")) as ConformanceRequest;
    process.stdout.write(`${JSON.stringify(await runConformanceCase(request))}\n`);
    return 0;
  }
  const { values, positionals } = parseArgs({
    args: [...rest],
    allowPositionals: true,
    options: {
      store: { type: "string" },
      trust: { type: "string", multiple: true },
      "local-domain": { type: "string", multiple: true },
      at: { type: "string" },
      json: { type: "boolean" },
      check: { type: "boolean" },
      update: { type: "boolean" },
      out: { type: "string" },
      locators: { type: "string" },
    },
  });
  const now = values.at === undefined ? new Date() : new Date(values.at);
  if (Number.isNaN(now.getTime())) throw new UsageError(`--at: not a time: ${values.at}`);
  const trustFiles = values.trust ?? [];
  const localDomains = values["local-domain"] ?? [];
  const trust = trustFiles.length > 0 || localDomains.length > 0 ? loadTrust(trustFiles, localDomains) : undefined;
  const store = storeOf(values.store);

  switch (command) {
    case "validate": {
      if (positionals.length === 0) throw new UsageError("validate needs at least one path");
      const reports: Report[] = [];
      for (const path of positionals) reports.push(...(await validatePath(resolve(path), { store, trust, now })));
      return printReports(reports, values.json === true) ? 0 : 1;
    }
    case "inspect": {
      const dir = packageDir(positionals);
      const pkg = await readPackage(readPackageDirectory(dir));
      let course: ComposedCourse | undefined;
      let unresolved: string | undefined;
      if (pkg.manifest.modules.length === 0 || store !== undefined) course = composeCourse(await resolvePackage(pkg, store));
      else unresolved = "modules not resolved: pass --store to compose the full outline";
      if (values.json === true) {
        process.stdout.write(formatJson({ id: pkg.manifest.id, version: pkg.manifest.version, specVersion: pkg.manifest.specVersion, digest: pkg.digest, title: pkg.manifest.title, modules: pkg.manifest.modules, course }));
        return 0;
      }
      const m = pkg.manifest;
      const lines = [
        `${m.title}`,
        `  package   ${m.id}@${m.version} (OCS ${m.specVersion})`,
        `  digest    ${pkg.digest}`,
        `  language  ${m.language}${m.subject === undefined ? "" : `, ${m.subject}`}${m.gradeBand === undefined ? "" : `, grades ${m.gradeBand}`}`,
        `  contents  ${pkg.units.size} units, ${pkg.activities.size} activities, ${pkg.resources.size} resources, ${pkg.codex.size} notes`,
        ...m.modules.map((module) => `  module    ${module.name}: ${module.package} ${module.range}${module.rights === undefined ? "" : ` (rights ≤ ${module.rights})`}`),
      ];
      if (course !== undefined) {
        lines.push("  outline");
        for (const unit of course.units) {
          lines.push(`    ${unit.key}  ${unit.title}${unit.renamed ? " (renamed)" : ""}`);
          for (const item of unit.items) {
            const detail = item.kind === "resource" ? ` [${item.use}]` : item.kind === "codex" ? ` [${item.note.visibility}${item.note.purpose === "answer-key" ? ", answer key" : ""}]` : ` [${item.activity.role}]`;
            lines.push(`      ${item.kind.padEnd(8)} ${item.title}${detail}`);
          }
        }
        if (course.hidden.length > 0) lines.push(`  hidden    ${course.hidden.join(", ")}`);
        if (course.repeated.length > 0) lines.push(`  repeated  ${course.repeated.join(", ")}`);
      } else lines.push(`  note: ${unresolved}`);
      process.stdout.write(`${lines.join("\n")}\n`);
      return 0;
    }
    case "lock": {
      const dir = packageDir(positionals.slice(0, 1));
      const files = readPackageDirectory(dir);
      const pkg = await readPackage(files);
      const update = values.update === true ? (positionals.length > 1 ? positionals.slice(1) : "all") : undefined;
      if (update === undefined && positionals.length > 1) throw new UsageError("module names are only allowed with --update");
      const resolution = await resolvePackage(pkg, store, update);
      const text = serializeLock(resolution.lock);
      if (values.check === true) {
        if (files[LOCK_PATH] === text) {
          process.stdout.write(`ok   ${dir}: ocs.lock is current\n`);
          return 0;
        }
        process.stdout.write(`FAIL ${dir}: ocs.lock ${files[LOCK_PATH] === undefined ? "is missing" : "is not current"}; run \`ocs lock\`\n`);
        return 1;
      }
      writeFileSync(join(dir, LOCK_PATH), text);
      const before = new Map((pkg.lock?.packages ?? []).map((entry) => [entry.id, entry.version]));
      for (const entry of resolution.lock.packages) {
        const from = before.get(entry.id);
        if (from !== entry.version) process.stdout.write(`  ${entry.id} ${from === undefined ? "added at" : `${from} ->`} ${entry.version}\n`);
      }
      process.stdout.write(`wrote ${join(dir, LOCK_PATH)} (${resolution.lock.packages.length} packages)\n`);
      return 0;
    }
    case "verify": {
      const target = positionals[0];
      if (target === undefined || positionals.length > 1) throw new UsageError("verify needs one bundle, store or package");
      const path = resolve(target);
      if (statSync(path).isDirectory() && isPackageDirectory(path)) {
        const files = readPackageDirectory(path);
        const pkg = await readPackage(files);
        if (pkg.lock === undefined) throw new UsageError(`${target} has no ocs.lock to verify`);
        const report: Report = { path, kind: "package", ok: false, id: pkg.manifest.id, version: pkg.manifest.version, digest: pkg.digest, problems: [], notes: [] };
        try {
          const resolution = await resolveCourse(pkg, store ?? EMPTY, { locked: pkg.lock });
          if (serializeLock(resolution.lock) !== files[LOCK_PATH]) report.problems.push("the packages no longer resolve to the locked versions");
          if (resolution.lock.root.digest !== pkg.lock.root.digest) report.problems.push(`the package's digest is ${pkg.digest}, but ocs.lock records ${pkg.lock.root.digest}`);
          report.notes.push(`${resolution.lock.packages.length} locked packages match their digests`);
        } catch (error) {
          report.problems.push(...messages(error));
        }
        report.ok = report.problems.length === 0;
        return printReports([report], values.json === true) ? 0 : 1;
      }
      if (statSync(path).isDirectory()) {
        const dirStore = new DirectoryStore(path);
        const effective = loadTrust(trustFiles, localDomains, dirStore.trust());
        const reports: Report[] = [];
        for (const file of walkFiles(join(path, "bundles"))) reports.push(await checkBundle(file, effective, now));
        if (reports.length === 0) throw new UsageError(`${target} has no bundles/ to verify`);
        return printReports(reports, values.json === true) ? 0 : 1;
      }
      if (trust === undefined) throw new UsageError("verifying a bundle needs --trust or --local-domain");
      return printReports([await checkBundle(path, trust, now)], values.json === true) ? 0 : 1;
    }
    case "compose": {
      const { course } = await compose(packageDir(positionals), store);
      process.stdout.write(formatJson(course));
      return 0;
    }
    case "export-thin-cc": {
      const dir = packageDir(positionals);
      if (values.out === undefined) throw new UsageError("export-thin-cc needs --out");
      const pkg = await readPackage(readPackageDirectory(dir));
      const locators = values.locators === undefined ? {} : (readJson(values.locators) as Record<string, string>);
      const { files, losses } = await cartridgeFromOcs(pkg, async (release) => locators[`${release.resourceId}@${release.version}`] ?? locators[release.resourceId]);
      const out = resolve(values.out);
      if (out.endsWith(".imscc") || out.endsWith(".zip")) {
        const entries = [...files].toSorted(([a], [b]) => (a === "imsmanifest.xml" ? -1 : b === "imsmanifest.xml" ? 1 : a < b ? -1 : 1));
        writeFileSync(out, writeZip(entries.map(([path, text]) => ({ path, bytes: new TextEncoder().encode(text) }))));
      } else {
        for (const [path, text] of files) {
          mkdirSync(dirname(join(out, path)), { recursive: true });
          writeFileSync(join(out, path), text);
        }
      }
      process.stdout.write(`wrote ${out} (${files.size} files)\n`);
      for (const loss of losses) process.stdout.write(`  not carried: ${loss.kind} at ${loss.at}\n`);
      return 0;
    }
    default:
      throw new UsageError(`unknown command: ${command}`);
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    if (error instanceof UsageError || (error instanceof TypeError && "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS"))) {
      process.stderr.write(`ocs: ${error.message}\nRun \`ocs --help\` for usage.\n`);
      process.exitCode = 2;
      return;
    }
    for (const message of messages(error)) process.stderr.write(`ocs: ${message}\n`);
    process.exitCode = 1;
  },
);
