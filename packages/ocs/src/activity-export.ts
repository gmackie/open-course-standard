// Portable activities (OCS 1.1 §14): an activity definition export is the data a destination needs
// to author the same activity in its own systems, and nothing that only means something to the
// destination that wrote it. A course package points at one by publisher-scoped ID, version and
// digest; the destination imports it as a draft definition, which its own teachers review and
// publish, with alignments resolved against its own catalog.
import { z } from "zod";
import { OcsError, type PackageIssue } from "./errors.ts";
import { canonicalJson, contentDigest } from "./json.ts";
import { ActivityExportId, hasActiveContent, OCS_PORTABLE_SPEC_VERSION, PlainText, type PortableActivityRef, type Sha256Digest, TEXT_SCHEMA } from "./schema.ts";
import { SemVer } from "./semver.ts";
import { AiHelpLevel, AlignmentRequest, ArtifactType, GradeBand, LanguageTag, LocalId, Subject } from "./vocab.ts";

// Text is checked for active content by the export-wide rule below; the schema states it per field.
const Text = (max: number) => z.string().trim().min(1).max(max).meta(TEXT_SCHEMA);

/** The ID of a rubric criterion or level: lowercase letters, digits and dashes, as rubric releases use. */
const RubricPartId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/, "expected lowercase letters, digits and dashes");

/** One performance level of a rubric criterion, worth `points`. */
export const ExportRubricLevel = z.strictObject({
  id: RubricPartId,
  label: PlainText(200),
  points: z.number().nonnegative().max(1000),
});
/** An exported rubric level. */
export type ExportRubricLevel = z.infer<typeof ExportRubricLevel>;

/** One rubric criterion: what is judged, and its levels, lowest first. */
export const ExportRubricCriterion = z.strictObject({
  id: RubricPartId,
  title: PlainText(200),
  description: PlainText(2000).optional(),
  levels: z
    .array(ExportRubricLevel)
    .min(1)
    .max(10)
    .refine((levels) => levels.every((level, i) => i === 0 || level.points > levels[i - 1]!.points), "levels are listed lowest first, each worth more points than the one before")
    .refine((levels) => new Set(levels.map((l) => l.id)).size === levels.length, "level IDs are unique within a criterion"),
});
/** An exported rubric criterion. */
export type ExportRubricCriterion = z.infer<typeof ExportRubricCriterion>;

/**
 * The rubric an export is assessed with, as data: criteria and levels. It carries no evaluator
 * checks (their configuration may hold answer keys) and no AI instructions; the destination makes
 * its own rubric from it.
 */
export const ExportRubric = z.strictObject({
  title: PlainText(200),
  criteria: z
    .array(ExportRubricCriterion)
    .min(1)
    .max(50)
    .refine((criteria) => new Set(criteria.map((c) => c.id)).size === criteria.length, "criterion IDs are unique within a rubric"),
});
/** An exported rubric. */
export type ExportRubric = z.infer<typeof ExportRubric>;

/**
 * A short text the activity has students read or hear, carried with the export because resource
 * releases are local to a destination. The destination imports each as a resource of its own.
 */
export const ExportReading = z.strictObject({
  id: LocalId,
  title: PlainText(200),
  body: PlainText(20_000),
  /** Who wrote it, or where it is from, and its rights status. */
  attribution: PlainText(500).optional(),
});
/** An exported reading. */
export type ExportReading = z.infer<typeof ExportReading>;

/** When a portable activity is due: never a fixed instant, which only suits one destination's calendar. */
export const PortableDueRule = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("none") }),
  z.strictObject({ kind: z.literal("after-install"), days: z.int().min(1).max(365) }),
]);
/** A portable due rule. */
export type PortableDueRule = z.infer<typeof PortableDueRule>;

/** What every template's inputs have (OCS 1.1 §14.4). */
const portableCommon = {
  title: Text(200),
  subject: Subject,
  gradeBand: GradeBand,
  overview: Text(5000),
  /** The export's readings the activity uses, by reading ID, in the order students meet them. */
  resources: z.array(LocalId).max(20).default([]),
  aiHelp: AiHelpLevel,
  /** Kinds of work allowed beyond those the template's steps ask for. */
  additionalArtifactTypes: z.array(ArtifactType).max(12).default([]),
  due: PortableDueRule,
  collaboration: z.enum(["individual", "group"]).default("individual"),
};

/** Sentence starters for young learners, such as "I see a ___." */
const SentenceFrames = z.array(Text(200)).max(10).default([]);

/** How a young learner answers a question: by speaking, drawing or writing. */
export const AnswerMode = z.enum(["speaking", "drawing", "writing"]);
/** An answer mode. */
export type AnswerMode = z.infer<typeof AnswerMode>;

/** A writing task, such as an argumentative essay. */
export const PortableWritingTask = z.strictObject({
  template: z.literal("writing-task"),
  ...portableCommon,
  prompt: Text(5000),
  genre: z.enum(["argument", "informative", "narrative", "literary-analysis"]),
  minWords: z.int().min(1).max(20_000).optional(),
  /** How many sources the writing must cite; 0 for none. */
  minimumCitations: z.int().min(0).max(50),
});
/** A science investigation: question, method, a data table and analysis. */
export const PortableScienceInvestigation = z.strictObject({
  template: z.literal("science-investigation"),
  ...portableCommon,
  question: Text(2000),
  methodPrompt: Text(5000),
  dataColumns: z.array(z.strictObject({ name: z.string().trim().min(1).max(100), unit: z.string().trim().min(1).max(50).optional() })).min(1).max(30),
  analysisPrompt: Text(5000),
});
/** A primary-source analysis: its sources are readings of the export, by ID. */
export const PortablePrimarySourceAnalysis = z.strictObject({
  template: z.literal("primary-source-analysis"),
  ...portableCommon,
  sources: z.array(LocalId).min(1).max(20),
  sourcingQuestions: z.array(Text(1000)).min(1).max(20),
  contextualizationQuestions: z.array(Text(1000)).min(1).max(20),
  claimPrompt: Text(5000),
  /** How many pieces of evidence from the sources the claim must cite. */
  minimumEvidence: z.int().min(1).max(20),
});
/** A problem set: prompts only. Answers belong in the course's teacher-only answer key. */
export const PortableProblemSet = z.strictObject({
  template: z.literal("problem-set"),
  ...portableCommon,
  problems: z.array(z.strictObject({ prompt: Text(5000) })).min(1).max(50),
  /** Whether students must show their reasoning. */
  showWork: z.boolean(),
});
/** A picture response, for young learners: look or listen, then draw or photograph an answer. */
export const PortablePictureResponse = z.strictObject({
  template: z.literal("picture-response"),
  ...portableCommon,
  lookPrompt: Text(1000),
  drawPrompt: Text(500),
  tellAboutIt: z.boolean().default(true),
  sentenceFrames: SentenceFrames,
});
/** Read and respond, for young learners: hear a short text, then answer one question a step. */
export const PortableReadAndRespond = z.strictObject({
  template: z.literal("read-and-respond"),
  ...portableCommon,
  passage: Text(3000),
  questions: z.array(z.strictObject({ prompt: Text(500), answerBy: AnswerMode.optional() })).min(1).max(10),
  answerBy: AnswerMode.default("speaking"),
  sentenceFrames: SentenceFrames,
});

/**
 * An activity template and its inputs (OCS 1.1 §14.4): `resources` and `sources` name the
 * export's readings, there are no alignments (they are on the export), no rubric reference (the
 * rubric is data on the export), no answers, and `due` is never a fixed instant.
 */
export const PortableTemplateInput = z.discriminatedUnion("template", [
  PortableWritingTask,
  PortableScienceInvestigation,
  PortablePrimarySourceAnalysis,
  PortableProblemSet,
  PortablePictureResponse,
  PortableReadAndRespond,
]);
/** Portable template inputs, as an author writes them. */
export type PortableTemplateInput = z.input<typeof PortableTemplateInput>;

/** Every string in a value, with its JSON path. */
function* strings(value: unknown, path: string): Generator<[string, string]> {
  if (typeof value === "string") yield [path, value];
  else if (Array.isArray(value)) for (const [index, item] of value.entries()) yield* strings(item, `${path}.${index}`);
  else if (value !== null && typeof value === "object") for (const [key, item] of Object.entries(value)) yield* strings(item, path === "" ? key : `${path}.${key}`);
}

/**
 * An activity definition export (OCS 1.1 §14), one JSON file. It is data only, and
 * holds student-facing text only: no scope, principals, answer keys or code, and the same
 * plain-text rule as package text applies to every string in it.
 */
export const ActivityExport = z
  .strictObject({
    specVersion: z.literal(OCS_PORTABLE_SPEC_VERSION),
    /** Publisher-scoped: `<domain>/<name>`, such as `educateos.io/grade-1-reading-foundations-word-builders`. */
    id: ActivityExportId,
    /** Immutable once published: a change is a new version. */
    version: SemVer,
    language: LanguageTag,
    /** The template and its inputs. */
    activity: PortableTemplateInput,
    /** The rubric, as data. */
    rubric: ExportRubric.optional(),
    /** The learning goals, by CASE competency URI, never by a destination's catalog revision. */
    alignments: z.array(AlignmentRequest).max(20),
    /** Texts the activity has students read or hear. */
    readings: z.array(ExportReading).max(20).default([]),
  })
  .superRefine((exported, ctx) => {
    const readings = exported.readings.map((reading) => reading.id);
    if (new Set(readings).size !== readings.length) ctx.addIssue({ code: "custom", path: ["readings"], message: "a reading ID is used more than once" });
    const known = new Set(readings);
    const named = [
      ...exported.activity.resources.map((id, index) => [["activity", "resources", index], id] as const),
      ...(exported.activity.template === "primary-source-analysis" ? exported.activity.sources.map((id, index) => [["activity", "sources", index], id] as const) : []),
    ];
    for (const [path, id] of named) if (!known.has(id)) ctx.addIssue({ code: "custom", path: [...path], message: `there is no reading ${id}` });
    const goals = exported.alignments.map((a) => `${a.frameworkKey} ${a.competencyUri}`);
    if (new Set(goals).size !== goals.length) ctx.addIssue({ code: "custom", path: ["alignments"], message: "an alignment is listed more than once" });
    for (const [path, text] of strings(exported, "")) {
      if (hasActiveContent(text)) ctx.addIssue({ code: "custom", path: path.split("."), message: "export text is plain text and may not contain scripts or active markup" });
    }
  });
/** An activity definition export, as read. */
export type ActivityExport = z.infer<typeof ActivityExport>;
/** An activity definition export, as an author writes it (defaults may be left out). */
export type ActivityExportInput = z.input<typeof ActivityExport>;

const MAX_EXPORT_BYTES = 256 * 1024;

/** An export read and checked, with its digest. */
export interface ParsedActivityExport {
  export: ActivityExport;
  digest: Sha256Digest;
}

function parseExportJson(text: string): unknown {
  if (new TextEncoder().encode(text).byteLength > MAX_EXPORT_BYTES) {
    throw new OcsError({ kind: "invalid-export", issues: [{ path: "", message: `is larger than ${MAX_EXPORT_BYTES} bytes` }] });
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new OcsError({ kind: "invalid-export", issues: [{ path: "", message: "is not valid JSON" }] });
  }
}

/**
 * The export digest: `sha256:` over the canonical JSON of the file, as package files are digested
 * (OCS 1.1 §14.3). Formatting and key order do not change it; any change of content does.
 *
 * @throws OcsError `invalid-export` if the text is not JSON or is too large.
 */
export async function activityExportDigest(text: string): Promise<Sha256Digest> {
  return contentDigest(parseExportJson(text));
}

/**
 * Reads one export file: parses it strictly and computes its digest.
 *
 * @throws OcsError `invalid-export` listing every problem found.
 */
export async function readActivityExport(text: string): Promise<ParsedActivityExport> {
  const json = parseExportJson(text);
  const parsed = ActivityExport.safeParse(json);
  if (!parsed.success) {
    const exportId = typeof (json as { id?: unknown } | null)?.id === "string" ? (json as { id: string }).id : undefined;
    const issues: PackageIssue[] = parsed.error.issues.map((issue) => ({ path: issue.path.join(".") || "export", message: issue.message }));
    throw new OcsError({ kind: "invalid-export", ...(exportId === undefined ? {} : { exportId }), issues });
  }
  return { export: parsed.data, digest: await contentDigest(json) };
}

/**
 * An export's file in the canonical form OCS writes every file in, after checking it. The value is
 * written as given, not with defaults filled in, because the digest covers what the file says.
 *
 * @throws z.ZodError if `exported` is not a valid export.
 */
export function writeActivityExport(exported: ActivityExportInput): string {
  ActivityExport.parse(exported);
  return `${JSON.stringify(JSON.parse(canonicalJson(exported)), null, 2)}\n`;
}

/** The reference that names a parsed export exactly. */
export const exportRef = ({ export: exported, digest }: ParsedActivityExport): PortableActivityRef => ({ id: exported.id, version: exported.version, digest });

/** One published export version as a source holds it. */
export interface PublishedActivityExport {
  /** The export file, as published. */
  text: string;
  /** The digest recorded at publication. Readers check the text against it. */
  digest: Sha256Digest;
}

/**
 * Where published activity exports come from: the same libraries packages come from (OCS 1.1
 * §14.6). Like a package source, it is not trusted: readers check every export's ID, version and
 * digest themselves.
 */
export interface ActivityExportSource {
  /** Every published version of an export, in any order; empty if it is unknown. */
  listExportVersions(id: string): Promise<readonly string[]>;
  /** One published version, or undefined if there is none. */
  getExport(id: string, version: string): Promise<PublishedActivityExport | undefined>;
}
