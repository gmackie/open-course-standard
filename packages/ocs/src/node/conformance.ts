// The reference implementation's conformance adapter (conformance/README.md): answers one
// conformance case request with the result the runner compares against the case's expectation.
// `ocs conformance-adapter` reads a request on stdin and writes the response on stdout.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readActivityExport } from "../activity-export.ts";
import { openBundle } from "../bundle.ts";
import { type ComposedCourse, composeCourse } from "../composer.ts";
import { OcsError, OcsFailure } from "../errors.ts";
import type { OcsPackage } from "../package.ts";
import { readPackage } from "../package.ts";
import type { PackageSource, PublishedPackage } from "../resolver.ts";
import { resolveCourse, serializeLock } from "../resolver.ts";
import { OcsLock } from "../schema.ts";
import { checkExportPublication, checkPublication, PublisherTrust } from "../signatures.ts";
import { DirectoryStore, readPackageDirectory } from "./store.ts";

/** One conformance case, as the runner sends it. Paths in `input` are relative to `caseDir`. */
export interface ConformanceRequest {
  kind: "package" | "export" | "resolve" | "compose" | "bundle" | "publication";
  caseDir: string;
  input: Record<string, string>;
}

/**
 * A conformance store: `store/<domain>/<name>/<version>/` per package version, and optionally
 * `store/published-digests.json` mapping `id@version` to the digest recorded at publication (by
 * default, the digest of the files).
 */
class ConformanceStore implements PackageSource {
  readonly #inner: DirectoryStore;
  readonly #published: Record<string, string>;

  constructor(root: string) {
    this.#inner = new DirectoryStore(root);
    const path = join(root, "published-digests.json");
    this.#published = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, string>) : {};
  }

  listVersions(id: string) {
    return this.#inner.listVersions(id);
  }

  async getPackage(id: string, version: string): Promise<PublishedPackage | undefined> {
    const found = await this.#inner.getPackage(id, version);
    const recorded = this.#published[`${id}@${version}`];
    return found === undefined || recorded === undefined ? found : { ...found, digest: recorded };
  }
}

/** The part of a composed course the conformance suite compares (OCS 1.1 §12.4). */
export function outlineProjection(course: ComposedCourse) {
  return {
    packageId: course.packageId,
    version: course.version,
    units: course.units.map((unit) => ({
      key: unit.key,
      title: unit.title,
      renamed: unit.renamed,
      provenance: { packageId: unit.provenance.packageId, version: unit.provenance.version, digest: unit.provenance.digest, modules: unit.provenance.modules },
      items: unit.items.map((item) => ({ key: item.key, kind: item.kind, title: item.title, renamed: item.renamed, ...(item.kind === "resource" ? { use: item.use } : {}) })),
    })),
    hidden: course.hidden,
    repeated: course.repeated,
    standards: course.standards,
  };
}

const problemOf = (error: unknown): string => {
  if (error instanceof OcsError) return error.problem.kind;
  throw error;
};

async function resolveCase(request: ConformanceRequest): Promise<{ root: OcsPackage; resolution: Awaited<ReturnType<typeof resolveCourse>> }> {
  const at = (path: string) => join(request.caseDir, path);
  const root = await readPackage(readPackageDirectory(at(request.input.course!)));
  const store = new ConformanceStore(at(request.input.store ?? "store"));
  const locked = request.input.lock === undefined ? undefined : OcsLock.parse(JSON.parse(readFileSync(at(request.input.lock), "utf8")));
  return { root, resolution: await resolveCourse(root, store, { locked }) };
}

/** Runs one conformance case against the reference implementation. */
export async function runConformanceCase(request: ConformanceRequest): Promise<Record<string, unknown>> {
  const at = (path: string) => join(request.caseDir, path);
  switch (request.kind) {
    case "package":
      try {
        const pkg = await readPackage(readPackageDirectory(at(request.input.package!)));
        return { valid: true, digest: pkg.digest };
      } catch (error) {
        return { valid: false, problem: problemOf(error) };
      }
    case "export":
      try {
        const parsed = await readActivityExport(readFileSync(at(request.input.export!), "utf8"));
        return { valid: true, digest: parsed.digest };
      } catch (error) {
        return { valid: false, problem: problemOf(error) };
      }
    case "resolve":
      try {
        return { lock: serializeLock((await resolveCase(request)).resolution.lock) };
      } catch (error) {
        return { problem: problemOf(error) };
      }
    case "compose":
      try {
        return { outline: outlineProjection(composeCourse((await resolveCase(request)).resolution)) };
      } catch (error) {
        return { problem: problemOf(error) };
      }
    case "bundle": {
      const trust = PublisherTrust.parse(JSON.parse(readFileSync(at(request.input.trust!), "utf8")));
      try {
        await openBundle(JSON.parse(readFileSync(at(request.input.bundle!), "utf8")), trust, new Date(request.input.at!));
        return { accepted: true };
      } catch (error) {
        if (error instanceof OcsFailure && error.code === "unauthenticated") return { accepted: false, reason: /\(([a-z-]+)\)$/.exec(error.message)?.[1] ?? "unauthenticated" };
        if (error instanceof OcsFailure) return { accepted: false, reason: "invalid" };
        throw error;
      }
    }
    case "publication": {
      const trust = PublisherTrust.parse(JSON.parse(readFileSync(at(request.input.trust!), "utf8")));
      const envelope = JSON.parse(readFileSync(at(request.input.envelope!), "utf8")) as unknown;
      const now = new Date(request.input.at!);
      if (request.input.package !== undefined) {
        const pkg = await readPackage(readPackageDirectory(at(request.input.package)));
        return await checkPublication(pkg, envelope, trust, now);
      }
      const parsed = await readActivityExport(readFileSync(at(request.input.export!), "utf8"));
      return await checkExportPublication({ id: parsed.export.id, version: parsed.export.version, digest: parsed.digest }, envelope, trust, now);
    }
  }
}
