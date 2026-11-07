// Exercises the built library (dist/) on the running Node.js version, so CI can prove the package
// works on Node.js 20, the oldest version it supports, without the dev toolchain (which needs 22).
// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import {
  checkPublication,
  composeCourse,
  formatJson,
  keyIdFor,
  InMemoryPackageLibrary,
  readPackage,
  resolveCourse,
  serializeLock,
  SigningIdentity,
  signPackagePublication,
} from "../dist/index.js";

const unit = (id, items) => ({ id, title: `Unit ${id}`, standards: [], items });
const manifest = (id, version, extra = {}) => ({ specVersion: "1.0", id, version, title: id, language: "en", standards: [], modules: [], overrides: [], outline: [], ...extra });

const safety = {
  "ocs.json": formatJson(manifest("labsafe.example/lab-safety", "1.2.0", { outline: [{ kind: "unit", unit: "rules" }] })),
  "units/rules.json": formatJson(unit("rules", [{ kind: "codex", ref: "goggles" }])),
  "codex/goggles.json": formatJson({ id: "goggles", title: "Goggles", body: "Wear goggles.", purpose: "context", visibility: "students" }),
};
const course = {
  "ocs.json": formatJson(manifest("northfield.example/biology-9", "1.0.0", {
    modules: [{ name: "safety", package: "labsafe.example/lab-safety", range: "^1.0.0" }],
    outline: [{ kind: "module", module: "safety" }],
  })),
};

const library = new InMemoryPackageLibrary();
await library.publish(safety);
const root = await readPackage(course);
const resolution = await resolveCourse(root, library);
const lock = serializeLock(resolution.lock);
assert.equal(serializeLock((await resolveCourse(root, library)).lock), lock, "lockfiles are byte-identical");
assert.deepEqual(composeCourse(resolution).units.map((u) => u.key), ["safety:rules"]);

const publisher = await SigningIdentity.generate();
const pkg = await readPackage(safety);
const envelope = await signPackagePublication(publisher, { packageId: pkg.manifest.id, version: "1.2.0", digest: pkg.digest, publishedAt: "2026-11-01T00:00:00Z" });
const trust = { localDomains: [], publishers: [{ domain: "labsafe.example", keys: [{ keyId: await keyIdFor(publisher.publicKey), publicKey: publisher.publicKey }] }] };
assert.deepEqual(await checkPublication(pkg, envelope, trust, new Date()), { ok: true, signed: true });

console.log(`smoke: ok on Node.js ${process.version}`);
