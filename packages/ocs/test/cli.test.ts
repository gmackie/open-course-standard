// The `ocs` CLI over a package store on disk: validate, inspect, lock, verify, compose and
// export-thin-cc, with their exit codes.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildBundle, formatJson, keyIdFor, readPackage, serializeBundle, SigningIdentity, signPackagePublication } from "../src/index.ts";
import { IDS, packageFiles, resource, unit } from "./helpers.ts";

const CLI = join(import.meta.dirname, "../src/cli.ts");

function ocs(...args: string[]) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", CLI, ...args], { encoding: "utf8" });
  return { code: result.status, out: result.stdout, err: result.stderr };
}

let root: string;
const write = (dir: string, files: Record<string, string>) => {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
};

const course = () =>
  packageFiles({
    manifest: {
      id: IDS.course,
      version: "1.0.0",
      modules: [{ name: "safety", package: IDS.safety, range: "^1.0.0" }],
      outline: [{ kind: "unit", unit: "cells" }, { kind: "module", module: "safety" }],
      overrides: [{ kind: "rename", target: { modules: ["safety"], unit: "rules" }, title: "Staying safe" }],
    },
    units: [unit("cells", [{ kind: "resource", ref: "diagram" }])],
    resources: [resource("diagram", "link")],
  });
const safety = (version: string) =>
  packageFiles({ manifest: { id: IDS.safety, version, outline: [{ kind: "unit", unit: "rules" }] }, units: [unit("rules", [{ kind: "resource", ref: "goggles" }])], resources: [resource("goggles", "embed")] });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ocs-cli-"));
  write(join(root, "northfield.example/biology-9"), course());
  write(join(root, "labsafe.example/lab-safety/1.0.0"), safety("1.0.0"));
  write(join(root, "labsafe.example/lab-safety/1.1.0"), safety("1.1.0"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const coursePath = () => join(root, "northfield.example/biology-9");

describe("ocs CLI", () => {
  it("locks a course against a store, byte for byte the same every time, and checks it", () => {
    expect(ocs("lock", coursePath(), "--check", "--store", root).code).toBe(1);
    const locked = ocs("lock", coursePath(), "--store", root);
    expect(locked.code).toBe(0);
    expect(locked.out).toContain("labsafe.example/lab-safety added at 1.1.0");
    const first = readFileSync(join(coursePath(), "ocs.lock"), "utf8");
    expect(ocs("lock", coursePath(), "--store", root).code).toBe(0);
    expect(readFileSync(join(coursePath(), "ocs.lock"), "utf8")).toBe(first);
    expect(ocs("lock", coursePath(), "--check", "--store", root).code).toBe(0);
  });

  it("keeps a locked version until asked to update", () => {
    rmSync(join(root, "labsafe.example/lab-safety/1.1.0"), { recursive: true });
    ocs("lock", coursePath(), "--store", root);
    write(join(root, "labsafe.example/lab-safety/1.1.0"), safety("1.1.0"));
    ocs("lock", coursePath(), "--store", root);
    expect(readFileSync(join(coursePath(), "ocs.lock"), "utf8")).toContain(`"version": "1.0.0"`);
    expect(ocs("lock", coursePath(), "--store", root, "--update", "safety").out).toContain("1.0.0 -> 1.1.0");
  });

  it("validates a store, and fails on a stale lockfile, a stray file or an invalid package", () => {
    ocs("lock", coursePath(), "--store", root);
    const ok = ocs("validate", root);
    expect(ok.code, ok.out).toBe(0);
    expect(ok.out).toContain("0 failed");

    write(join(root, "labsafe.example/lab-safety/1.2.0"), safety("1.2.0"));
    const stale = ocs("validate", root);
    expect(stale.code).toBe(0); // the locked 1.1.0 still fits, so the lock is still current
    rmSync(join(root, "labsafe.example/lab-safety/1.1.0"), { recursive: true });
    const moved = ocs("validate", root);
    expect(moved.code).toBe(1);
    expect(moved.out).toContain("ocs.lock is not the lockfile");

    write(coursePath(), { "scripts/setup.js": "alert(1)" });
    const hostile = ocs("validate", coursePath(), "--store", root, "--json");
    expect(hostile.code).toBe(1);
    expect(JSON.parse(hostile.out).reports[0].problems.join("\n")).toMatch(/scripts\/setup.js: is not part of the course package layout/);
  });

  it("verifies a lockfile's digests, and refuses a module changed after publication", () => {
    ocs("lock", coursePath(), "--store", root);
    expect(ocs("verify", coursePath(), "--store", root).code).toBe(0);
    const tampered = safety("1.1.0");
    tampered["units/rules.json"] = formatJson({ ...JSON.parse(tampered["units/rules.json"]!), title: "Changed" });
    write(join(root, "labsafe.example/lab-safety/1.1.0"), tampered);
    const result = ocs("verify", coursePath(), "--store", root);
    expect(result.code).toBe(1);
    expect(result.out).toContain("digest-mismatch");
  });

  it("composes, inspects and exports a Thin CC", () => {
    const composed = JSON.parse(ocs("compose", coursePath(), "--store", root).out);
    expect(composed.units.map((u: { key: string; title: string }) => [u.key, u.title])).toStrictEqual([["cells", "Unit cells"], ["safety:rules", "Staying safe"]]);
    expect(ocs("inspect", coursePath(), "--store", root).out).toContain("safety:rules  Staying safe (renamed)");
    writeFileSync(join(root, "locators.json"), JSON.stringify({ rsc_diagram: "https://open.example/diagram" }));
    const out = join(root, "course.imscc");
    expect(ocs("export-thin-cc", coursePath(), "--out", out, "--locators", join(root, "locators.json")).code).toBe(0);
    const zip = readFileSync(out);
    expect(zip.subarray(0, 4)).toStrictEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(zip.toString("latin1")).toContain("https://open.example/diagram");
  });

  it("verifies a signed bundle against trusted keys only", async () => {
    const publisher = await SigningIdentity.generate();
    const files = safety("1.0.0");
    const pkg = await readPackage(files);
    const signature = await signPackagePublication(publisher, { packageId: IDS.safety, version: "1.0.0", digest: pkg.digest, publishedAt: "2026-11-01T00:00:00Z" });
    const bundle = join(root, "bundle.json");
    writeFileSync(bundle, serializeBundle(await buildBundle({ course: { files, signature }, exports: [] })));
    const keys = join(root, "publisher.json");
    writeFileSync(keys, JSON.stringify({ domain: "labsafe.example", keys: [{ keyId: await keyIdFor(publisher.publicKey), publicKey: publisher.publicKey }] }));
    expect(ocs("verify", bundle, "--trust", keys).code).toBe(0);
    const other = await SigningIdentity.generate();
    writeFileSync(keys, JSON.stringify({ domain: "labsafe.example", keys: [{ keyId: await keyIdFor(other.publicKey), publicKey: other.publicKey }] }));
    const refused = ocs("verify", bundle, "--trust", keys);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain("unknown-publisher");
  });

  it("reports misuse with exit status 2", () => {
    expect(ocs("frobnicate").code).toBe(2);
    expect(ocs("lock").code).toBe(2);
    expect(ocs("--help").code).toBe(0);
  });
});
