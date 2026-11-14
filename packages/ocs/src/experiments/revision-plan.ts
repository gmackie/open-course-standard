// Experimental teacher-reviewed course update planning. NOT part of OCS 1.1.
import { canonicalJson } from "../json.ts";
import { OcsFailure } from "../errors.ts";
import { readPackage, type OcsFiles } from "../package.ts";

export type RevisionDisposition = "unchanged" | "offer-upstream" | "keep-local" | "same-change" | "needs-review";

export interface RevisionEntry {
  path: string;
  disposition: RevisionDisposition;
  /** These booleans compare semantic JSON, not whitespace or member order. */
  changedLocally: boolean;
  changedUpstream: boolean;
  /** Treat all Codex entries as potentially sensitive during review. */
  sensitive: boolean;
}

export interface CourseRevisionPlan {
  sourcePackageId: string;
  baseVersion: string;
  localVersion: string;
  upstreamVersion: string;
  entries: RevisionEntry[];
  /** A preview never changes a class, its course library or an OCS package. */
  requiresTeacherApproval: true;
  hasConflicts: boolean;
}

/**
 * Compare three valid OCS package snapshots: the immutable version a teacher started with,
 * their locally adapted version, and a newer version published by the source.
 *
 * This is a deliberately conservative, per-file planner, NOT an automatic JSON merge. A
 * file changed differently on both sides requires review even when JSON fields differ.
 * Validates all inputs and ignores the generated ocs.lock. It does not authorize publication,
 * re-resolve dependencies, check external resource licenses or modify an installed class.
 */
export async function planCourseRevision(
  baseFiles: OcsFiles,
  localFiles: OcsFiles,
  upstreamFiles: OcsFiles,
): Promise<CourseRevisionPlan> {
  const [base, local, upstream] = await Promise.all([
    readPackage(baseFiles),
    readPackage(localFiles),
    readPackage(upstreamFiles),
  ]);
  if (base.manifest.id !== upstream.manifest.id) {
    throw new OcsFailure("validation-failed", "the new source version belongs to a different course");
  }
  if (base.manifest.version === upstream.manifest.version && base.digest !== upstream.digest) {
    throw new OcsFailure("conflict", "a published source version cannot change its content");
  }
  const paths = [...new Set([
    ...Object.keys(baseFiles), ...Object.keys(localFiles), ...Object.keys(upstreamFiles),
  ])].filter((path) => path !== "ocs.lock").toSorted();

  const content = (files: OcsFiles, path: string): string | undefined => {
    const text = files[path];
    return text === undefined ? undefined : canonicalJson(JSON.parse(text));
  };
  const entries = paths.map((path): RevisionEntry => {
    const original = content(baseFiles, path);
    const ours = content(localFiles, path);
    const theirs = content(upstreamFiles, path);
    const changedLocally = original !== ours;
    const changedUpstream = original !== theirs;
    const disposition: RevisionDisposition =
      !changedLocally && !changedUpstream ? "unchanged"
        : !changedLocally ? "offer-upstream"
        : !changedUpstream ? "keep-local"
        : ours === theirs ? "same-change" : "needs-review";
    return { path, disposition, changedLocally, changedUpstream, sensitive: path.startsWith("codex/") };
  });
  return {
    sourcePackageId: base.manifest.id,
    baseVersion: base.manifest.version,
    localVersion: local.manifest.version,
    upstreamVersion: upstream.manifest.version,
    entries,
    requiresTeacherApproval: true,
    hasConflicts: entries.some((entry) => entry.disposition === "needs-review"),
  };
}
