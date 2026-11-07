// The small vocabularies OCS 1.0 and 1.1 adopted from EducateOS's contracts, curriculum and
// registry, defined here so the reference implementation has no vendor dependency (OCS 1.1 §4.5,
// §6, §14.4). Their grammars are part of the published format and must not drift.
import { z } from "zod";

/** A local ID: kebab case starting with a letter (OCS 1.1 §4.2). */
export const LocalId = z.string().regex(/^[a-z][a-z0-9-]{0,62}$/, "expected a kebab-case ID");
/** A local ID. */
export type LocalId = z.infer<typeof LocalId>;

/** A BCP 47 language tag. */
export const LanguageTag = z.string().regex(/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/, "expected a BCP 47 language tag");
/** A language tag. */
export type LanguageTag = z.infer<typeof LanguageTag>;

/** The rights modes, narrowest first (OCS 1.1 §13). */
export const RightsMode = z.enum(["link", "embed", "excerpt", "licensed-copy"]);
/** A rights mode. */
export type RightsMode = z.infer<typeof RightsMode>;

/** The broad subject of a course (OCS 1.1 §6). */
export const Subject = z.enum([
  "english-language-arts",
  "science",
  "history-social-studies",
  "mathematics",
  "arts",
  "world-languages",
  "computer-science",
  "health-physical-education",
  "social-emotional-learning",
  "other",
]);
/** A subject. */
export type Subject = z.infer<typeof Subject>;

/** A grade or grade range, such as `K`, `7` or `9-12` (OCS 1.1 §6). */
export const GradeBand = z.string().regex(/^(K|\d{1,2})(-\d{1,2})?$/, "expected a grade band such as K, 7 or 9-12");
/** A grade band. */
export type GradeBand = z.infer<typeof GradeBand>;

/** An absolute URI, compared verbatim. */
export const AbsoluteUri = z
  .string()
  .min(1)
  .max(2048)
  .refine((value) => !/\s/.test(value) && URL.canParse(value), "expected an absolute URI");

/** A competency a package or activity aligns to, by framework and competency URI (OCS 1.1 §6.1). */
export const AlignmentRequest = z.strictObject({
  frameworkKey: z.string().min(1).max(100),
  competencyUri: AbsoluteUri,
});
/** An alignment. */
export type AlignmentRequest = z.infer<typeof AlignmentRequest>;

/** A district-local resource release ID (OCS 1.1 §4.5). */
export const ResourceId = z.string().regex(/^rsc_[a-z0-9][a-z0-9-]{0,62}$/, "expected a resource ID (rsc_…)");
/** A district-local activity definition ID (OCS 1.1 §4.5). */
export const ActivityDefinitionId = z.string().regex(/^adf_[a-z0-9][a-z0-9-]{0,62}$/, "expected an activity definition ID (adf_…)");

/** A district-local resource release: its resource ID and release version. */
export const ResourceReleaseRef = z.strictObject({
  resourceId: ResourceId,
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "expected a version such as 1.2.0"),
});
/** A resource release reference. */
export type ResourceReleaseRef = z.infer<typeof ResourceReleaseRef>;

/** An RFC 3339 UTC date-time ending in `Z`. */
export const UtcTimestamp = z.iso.datetime();
/** A UTC timestamp. */
export type UtcTimestamp = z.infer<typeof UtcTimestamp>;

/** Kinds of work a student may submit (OCS 1.1 §14.4). */
export const ArtifactType = z.enum([
  "document",
  "notebook",
  "spreadsheet",
  "presentation",
  "dataset",
  "image",
  "audio",
  "video",
  "interactive",
  "evidence",
  "portfolio",
  "external-ref",
]);
/** An artifact type. */
export type ArtifactType = z.infer<typeof ArtifactType>;

/** How much AI help students may have with an activity, widest first. */
export const AiHelpLevel = z.enum(["full", "hints-only", "none"]);
/** An AI-help level. */
export type AiHelpLevel = z.infer<typeof AiHelpLevel>;
