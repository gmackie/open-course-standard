import { describe, expect, it } from "vitest";
import { planCourseRevision } from "../src/experiments/revision-plan.ts";
import { packageFiles, unit } from "./helpers.ts";
import { formatJson } from "../src/json.ts";

const make = (version: string, title: string) => packageFiles({
  manifest: {
    id: "example.org/biology-intro", version,
    outline: [{ kind: "unit", unit: "cells" }],
  },
  units: [unit("cells", [], title)],
});

describe("experimental teacher-controlled course revision preview", () => {
  it("offers upstream edits, ignores lockfiles and does not automatically install", async () => {
    const base = make("1.0.0", "Cell biology");
    const upstream = make("1.1.0", "Cell biology and membranes");
    const plan = await planCourseRevision(base, base, upstream);
    expect(plan.requiresTeacherApproval).toBe(true);
    expect(plan.hasConflicts).toBe(false);
    expect(plan.entries.find((x) => x.path === "units/cells.json")?.disposition).toBe("offer-upstream");
    expect(plan.entries.map((x) => x.path)).not.toContain("ocs.lock");
  });

  it("retains local edits, flags competing edits and refuses a forged source identity", async () => {
    const base = make("1.0.0", "Cell biology");
    const local = make("1.0.1", "Cell biology with local example");
    const upstream = make("1.1.0", "Cell biology with new illustration");
    const plan = await planCourseRevision(base, local, upstream);
    expect(plan.hasConflicts).toBe(true);
    expect(plan.entries.find((x) => x.path === "units/cells.json")?.disposition).toBe("needs-review");
    const other = packageFiles({
      manifest: { id: "other.example/biology-intro", version: "1.1.0", outline: [{ kind: "unit", unit: "cells" }] },
      units: [unit("cells", [])],
    });
    await expect(planCourseRevision(base, local, other)).rejects.toThrow(/different course/);
  });

  it("compares semantic JSON rather than key order and refuses invalid files", async () => {
    const base = make("1.0.0", "Cell biology");
    const changed = { ...base, "units/cells.json": formatJson(JSON.parse(base["units/cells.json"]!)) };
    expect((await planCourseRevision(base, changed, base)).hasConflicts).toBe(false);
    await expect(planCourseRevision(base, { ...base, "script.js": "alert(1)" }, base)).rejects.toThrow();
  });
});
