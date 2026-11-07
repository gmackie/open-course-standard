// The JSON Schemas (schemas/1.1) are generated from the validators, and must agree with them: every
// document the implementation accepts passes its schema, and the structural refusals fail both.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { generate, SCHEMAS } from "../scripts/generate-schemas.ts";
import { formatJson, readActivityExport, readPackage, resolveCourse, serializeLock } from "../src/index.ts";
import { activity, IDS, libraryOf, packageFiles, resource, unit } from "./helpers.ts";

const DIR = join(import.meta.dirname, "../../../schemas/1.1");
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
const validators = new Map(SCHEMAS.map((entry) => [entry.file, ajv.compile(JSON.parse(readFileSync(join(DIR, entry.file), "utf8")))]));
const valid = (file: string, value: unknown) => {
  const validate = validators.get(file)!;
  const ok = validate(value);
  return ok ? true : (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`).join("; ");
};

const ENTRY_SCHEMA: Record<string, string> = { units: "unit.schema.json", activities: "activity.schema.json", resources: "resource.schema.json", codex: "codex-note.schema.json" };
const schemaFor = (path: string) => (path === "ocs.json" ? "ocs.schema.json" : path === "ocs.lock" ? "ocs-lock.schema.json" : ENTRY_SCHEMA[path.split("/")[0]!]!);

const course = () =>
  packageFiles({
    manifest: {
      id: IDS.course,
      version: "1.0.0",
      gradeBand: "9-12",
      subject: "science",
      modules: [{ name: "safety", package: IDS.safety, range: "^1.0.0", rights: "embed" }],
      outline: [{ kind: "unit", unit: "cells" }, { kind: "module", module: "safety" }],
      overrides: [{ kind: "rename", target: { modules: ["safety"], unit: "rules" }, title: "Lab safety" }],
    },
    units: [unit("cells", [{ kind: "activity", ref: "lab" }, { kind: "resource", ref: "diagram" }, { kind: "codex", ref: "key" }])],
    activities: [activity("lab", "adf_osmosis-lab")],
    resources: [resource("diagram", "excerpt")],
    codex: [{ id: "key", title: "Answers", body: "1. b", purpose: "answer-key", visibility: "teacher-only" }],
  });
const safety = () =>
  packageFiles({ manifest: { id: IDS.safety, version: "1.2.0", outline: [{ kind: "unit", unit: "rules" }] }, units: [unit("rules", [{ kind: "resource", ref: "goggles" }])], resources: [resource("goggles", "link")] });

describe("JSON Schemas", () => {
  it("are current with the validators they are generated from", () => {
    for (const entry of SCHEMAS) expect(readFileSync(join(DIR, entry.file), "utf8"), entry.file).toBe(generate(entry));
  });

  it("accept every file of packages and lockfiles the implementation accepts", async () => {
    const root = await readPackage(course());
    const lock = (await resolveCourse(root, await libraryOf(safety()))).lock;
    for (const files of [course(), safety(), { "ocs.lock": serializeLock(lock) }]) {
      for (const [path, text] of Object.entries(files)) expect(valid(schemaFor(path), JSON.parse(text)), path).toBe(true);
    }
  });

  it("refuse what the implementation refuses for its structure", async () => {
    const files = course();
    const manifest = JSON.parse(files["ocs.json"]!) as Record<string, unknown>;
    const unitFile = JSON.parse(files["units/cells.json"]!) as Record<string, unknown>;
    const refusals: [string, string, Record<string, unknown>][] = [
      ["ocs.json", "ocs.schema.json", { ...manifest, scripts: { postinstall: "sh" } }],
      ["ocs.json", "ocs.schema.json", { ...manifest, specVersion: "2.0" }],
      ["ocs.json", "ocs.schema.json", { ...manifest, id: "Biology 9" }],
      ["ocs.json", "ocs.schema.json", { ...manifest, title: "Hi<script>alert(1)</script>" }],
      ["ocs.json", "ocs.schema.json", { ...manifest, title: "   " }],
      ["ocs.json", "ocs.schema.json", { ...manifest, version: "1.0" }],
      ["units/cells.json", "unit.schema.json", { ...unitFile, title: "See JavaScript:alert(1)" }],
      ["units/cells.json", "unit.schema.json", { ...unitFile, onOpen: "alert(1)" }],
    ];
    for (const [path, schema, value] of refusals) {
      expect(valid(schema, value), JSON.stringify(value).slice(0, 80)).not.toBe(true);
      await expect(readPackage({ ...files, [path]: JSON.stringify(value) })).rejects.toMatchObject({ problem: { kind: "invalid-package" } });
    }
  });

  it("agree on activity exports", async () => {
    const exported = {
      specVersion: "1.1",
      id: "openbio.example/cell-models",
      version: "1.0.0",
      language: "en",
      activity: { template: "writing-task", title: "Models", subject: "science", gradeBand: "9-12", overview: "Compare models.", aiHelp: "hints-only", due: { kind: "none" }, prompt: "Compare two models.", genre: "informative", minimumCitations: 1, resources: ["models"] },
      alignments: [],
      readings: [{ id: "models", title: "Two models", body: "A diagram and a sample." }],
    };
    await readActivityExport(formatJson(exported));
    expect(valid("activity-export.schema.json", exported)).toBe(true);
    const hostile = { ...exported, activity: { ...exported.activity, prompt: "<iframe src=x>" } };
    expect(valid("activity-export.schema.json", hostile)).not.toBe(true);
    await expect(readActivityExport(formatJson(hostile))).rejects.toMatchObject({ problem: { kind: "invalid-export" } });
  });
});
