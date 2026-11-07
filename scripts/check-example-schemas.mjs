// Validates every JSON document in examples/ and every valid conformance fixture against the JSON
// Schemas in schemas/1.1, choosing the schema by the document's place in a package or store.
// Run with `pnpm check:example-schemas`. SPDX-License-Identifier: Apache-2.0
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaDir = join(root, "schemas/1.1");
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
const validators = new Map(readdirSync(schemaDir).map((file) => [file, ajv.compile(JSON.parse(readFileSync(join(schemaDir, file), "utf8")))]));

function* files(dir) {
  for (const name of readdirSync(dir).toSorted()) {
    if (name === ".DS_Store") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (name.endsWith(".json") || name === "ocs.lock") yield path;
  }
}

/** The package directory a file belongs to, if any: the nearest ancestor with an ocs.json. */
function packageRoot(path, stop) {
  for (let dir = dirname(path); dir.startsWith(stop) && dir !== stop; dir = dirname(dir)) {
    if (existsSync(join(dir, "ocs.json"))) return dir;
  }
  return undefined;
}

const ENTRY = { units: "unit.schema.json", activities: "activity.schema.json", resources: "resource.schema.json", codex: "codex-note.schema.json" };

function schemaFor(path, top) {
  const pkg = packageRoot(path, top);
  if (pkg !== undefined) {
    const inner = relative(pkg, path).split(sep);
    if (inner.length === 1) return inner[0] === "ocs.json" ? "ocs.schema.json" : inner[0] === "ocs.lock" ? "ocs-lock.schema.json" : undefined;
    return inner.length === 2 ? ENTRY[inner[0]] : undefined;
  }
  const rel = relative(top, path).split(sep);
  if (rel.includes("bundles")) return "bundle.schema.json";
  if (basename(path) === "publisher.json" || path.endsWith(".publisher.json")) return "publisher.schema.json";
  if (basename(dirname(path)) === "activities") return "activity-export.schema.json";
  return undefined;
}

let checked = 0;
const problems = [];
const check = (path, schema) => {
  const validate = validators.get(schema);
  checked++;
  if (!validate(JSON.parse(readFileSync(path, "utf8")))) problems.push(`${relative(root, path)} (${schema}): ${ajv.errorsText(validate.errors)}`);
};

for (const top of ["examples"].map((dir) => join(root, dir))) {
  for (const path of files(top)) {
    const schema = schemaFor(path, top);
    if (schema === undefined) {
      if (!path.endsWith(".md")) problems.push(`${relative(root, path)}: no schema applies to this file`);
      continue;
    }
    check(path, schema);
  }
}

// Conformance fixtures that are meant to be valid.
const cases = join(root, "conformance/cases");
for (const { id } of JSON.parse(readFileSync(join(cases, "index.json"), "utf8")).cases) {
  const dir = join(cases, id);
  const spec = JSON.parse(readFileSync(join(dir, "case.json"), "utf8"));
  const validInput = spec.expect.valid === true || spec.expect.lock !== undefined || spec.expect.outline !== undefined || spec.expect.accepted === true || spec.expect.ok === true;
  if (!validInput) continue;
  for (const path of files(dir)) {
    const name = basename(path);
    if (name === "case.json" || name === "expected-outline.json" || name === "published-digests.json") continue;
    const schema = name === "trust.json" ? "trust.schema.json" : name === "envelope.json" ? "signed-envelope.schema.json" : name === "expected.lock" || name === "previous.lock" ? "ocs-lock.schema.json" : schemaFor(path, dir) ?? (name === "export.json" ? "activity-export.schema.json" : name === "bundle.json" ? "bundle.schema.json" : undefined);
    if (schema === undefined) problems.push(`${relative(root, path)}: no schema applies to this file`);
    else check(path, schema);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`schemas: ${checked} example and fixture documents are valid`);
