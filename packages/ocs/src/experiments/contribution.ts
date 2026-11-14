// Experimental collaboration proposal profile. NOT an OCS 1.1 package or authority grant.
import { z } from "zod";
import { canonicalJson } from "../json.ts";
import { OcsFailure } from "../errors.ts";
import { readPackage, type OcsFiles } from "../package.ts";
import { OcsPackageId, PlainText, Sha256Digest } from "../schema.ts";
import { SemVer } from "../semver.ts";

export const ContributionPackageRef = z.strictObject({
  id: OcsPackageId,
  version: SemVer,
  digest: Sha256Digest,
});

const EntryPath = z.string().regex(/^(ocs\.json|(units|activities|resources|codex)\/[a-z][a-z0-9-]{0,62}\.json)$/);

export const ContributionProposalV0 = z.strictObject({
  profile: z.literal("ocs-collaboration/0.1"),
  /** Publisher- and reviewer-neutral identifier; not an authorization token. */
  id: z.string().min(1).max(200),
  source: ContributionPackageRef,
  candidate: ContributionPackageRef,
  purpose: z.enum(["correction", "accessibility", "localization", "enrichment", "other"]),
  summary: PlainText(2000),
  /** The proposer must account for every changed file, including ocs.json. */
  changedPaths: z.array(EntryPath).min(1).max(200).refine((paths) => new Set(paths).size === paths.length),
});
export type ContributionProposalV0 = z.infer<typeof ContributionProposalV0>;

function assertReference(
  reference: z.infer<typeof ContributionPackageRef>,
  pkg: Awaited<ReturnType<typeof readPackage>>,
  label: string,
): void {
  if (reference.id !== pkg.manifest.id ||
      reference.version !== pkg.manifest.version ||
      reference.digest !== pkg.digest) {
    throw new OcsFailure("validation-failed", label + " does not match the pinned publication");
  }
}

/**
 * Verify references and an exhaustive changed-path declaration. Does not authenticate a
 * contributor, authorize an institution to share content, validate licensing, or accept a
 * proposal. The caller must check publisher signatures and institution policy separately.
 */
export async function inspectContributionProposal(
  input: unknown,
  sourceFiles: OcsFiles,
  candidateFiles: OcsFiles,
): Promise<{ proposal: ContributionProposalV0; changedPaths: string[] }> {
  const parsed = ContributionProposalV0.safeParse(input);
  if (!parsed.success) throw new OcsFailure("validation-failed", "invalid contribution proposal: " + parsed.error.issues[0]?.message);
  const proposal = parsed.data;
  const [source, candidate] = await Promise.all([readPackage(sourceFiles), readPackage(candidateFiles)]);
  assertReference(proposal.source, source, "source");
  assertReference(proposal.candidate, candidate, "candidate");
  const paths = [...new Set([...Object.keys(sourceFiles), ...Object.keys(candidateFiles)])]
    .filter((path) => path !== "ocs.lock").toSorted();
  const normalized = (files: OcsFiles, path: string) => {
    const text = files[path];
    return text === undefined ? undefined : canonicalJson(JSON.parse(text));
  };
  const actual = paths.filter((path) => normalized(sourceFiles, path) !== normalized(candidateFiles, path));
  if (!actual.some((path) => path !== "ocs.json")) {
    throw new OcsFailure("validation-failed", "the proposed lesson has no substantive changes");
  }
  if (actual.join("\u0000") !== [...proposal.changedPaths].toSorted().join("\u0000")) {
    throw new OcsFailure("validation-failed", "changedPaths must list every changed OCS file exactly");
  }
  return { proposal, changedPaths: actual };
}
