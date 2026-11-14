import { describe, expect, it } from "vitest";
import { inspectContributionProposal } from "../src/experiments/contribution.ts";
import { readPackage } from "../src/package.ts";
import { packageFiles, unit } from "./helpers.ts";

const make = (version: string, title: string) => packageFiles({
  manifest: { id: "example.org/cells", version, outline: [{ kind: "unit", unit: "cells" }] },
  units: [unit("cells", [], title)],
});

describe("experimental cross-institution contribution envelope", () => {
  it("checks exact immutable source and candidate references and exhaustive changed files", async () => {
    const source = make("1.0.0", "Cells");
    const candidate = make("1.1.0", "Cells with accessibility guidance");
    const s = await readPackage(source);
    const c = await readPackage(candidate);
    const proposal = {
      profile: "ocs-collaboration/0.1",
      id: "proposal-example-001",
      source: { id: s.manifest.id, version: s.manifest.version, digest: s.digest },
      candidate: { id: c.manifest.id, version: c.manifest.version, digest: c.digest },
      purpose: "accessibility",
      summary: "Adds accessible examples for the unit.",
      changedPaths: ["ocs.json", "units/cells.json"],
    };
    const result = await inspectContributionProposal(proposal, source, candidate);
    expect(result.changedPaths).toStrictEqual(["ocs.json", "units/cells.json"]);
    await expect(inspectContributionProposal({ ...proposal, changedPaths: ["units/cells.json"] }, source, candidate))
      .rejects.toThrow(/every changed OCS file/);
    await expect(inspectContributionProposal({ ...proposal, candidate: { ...proposal.candidate, digest: s.digest } }, source, candidate))
      .rejects.toThrow(/pinned publication/);
    await expect(inspectContributionProposal({ ...proposal, changedPaths: ["ocs.json", "script.js"] }, source, candidate))
      .rejects.toThrow(/invalid contribution/);
  });

  it("rejects version-only changes as non-substantive", async () => {
    const source = make("1.0.0", "Cells");
    const candidate = make("1.1.0", "Cells");
    const s = await readPackage(source);
    const c = await readPackage(candidate);
    await expect(inspectContributionProposal({
      profile: "ocs-collaboration/0.1", id: "empty",
      source: { id: s.manifest.id, version: s.manifest.version, digest: s.digest },
      candidate: { id: c.manifest.id, version: c.manifest.version, digest: c.digest },
      purpose: "other", summary: "Version-only release", changedPaths: ["ocs.json"],
    }, source, candidate)).rejects.toThrow(/no substantive changes/);
  });
});
