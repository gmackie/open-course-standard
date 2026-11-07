import { describe, expect, it } from "vitest";
import { type CartridgeImport, cartridgeFromOcs, ocsFromCartridge, type OcsCodexNote, readPackage, type ReleasedLink } from "../src/index.ts";
import { activity, IDS, packageFiles, resource, unit } from "./helpers.ts";

const LOCATORS: Record<string, string> = {
  rsc_cells: "https://open-lessons.example/cells",
  rsc_osmosis: "https://open-lessons.example/osmosis",
};
const locate = async (release: { resourceId: string }) => LOCATORS[release.resourceId];

const answerKey: OcsCodexNote = { id: "key", title: "Answer key", body: "SECRET-ANSWERS", purpose: "answer-key", visibility: "teacher-only" };

describe("OCS to Thin CC", () => {
  it("carries units and released links, lists everything else, and reads back as a Thin CC", async () => {
    const pkg = await readPackage(packageFiles({
      manifest: {
        id: IDS.course,
        version: "1.0.0",
        title: "Biology 9",
        modules: [{ name: "safety", package: IDS.safety, range: "^1.0.0" }],
        outline: [{ kind: "unit", unit: "cells" }, { kind: "unit", unit: "transport" }, { kind: "module", module: "safety" }],
      },
      units: [
        unit("cells", [{ kind: "resource", ref: "cells" }, { kind: "activity", ref: "lab" }, { kind: "codex", ref: "key" }], "Cells & membranes"),
        unit("transport", [{ kind: "resource", ref: "osmosis" }, { kind: "resource", ref: "sim" }, { kind: "resource", ref: "lost" }], "Transport"),
      ],
      resources: [
        resource("cells", "link"),
        resource("osmosis", "embed"),
        resource("lost", "link"),
        { kind: "gadget-blueprint", id: "sim", title: "Osmosis simulator", release: { resourceId: "rsc_sim", version: "1.0.0" }, releaseCommit: "a".repeat(40), use: "link" },
      ],
      activities: [activity("lab", "adf_osmosis-lab")],
      codex: [answerKey],
    }));
    const { files, losses } = await cartridgeFromOcs(pkg, locate);
    expect(losses.toSorted((a, b) => a.at.localeCompare(b.at))).toStrictEqual([
      { kind: "activity", at: "cells#lab" },
      { kind: "codex-note", at: "cells#key" },
      { kind: "modules", at: IDS.course },
      { kind: "resource-without-locator", at: "transport#lost" },
      { kind: "rights-use", at: "transport#osmosis" },
      { kind: "gadget-blueprint", at: "transport#sim" },
    ].toSorted((a, b) => a.at.localeCompare(b.at)));
    // Nothing teacher-only or executable leaves.
    expect([...files.values()].join("\n")).not.toContain("SECRET-ANSWERS");
    expect([...files.keys()].toSorted()).toStrictEqual(["WL_1/weblink.xml", "WL_2/weblink.xml", "imsmanifest.xml"]);

    const manifest = files.get("imsmanifest.xml")!;
    expect(manifest).toContain("<schema>IMS Thin Common Cartridge</schema>");
    expect(manifest).toContain(`<item identifier="U_cells"><title>Cells &#38; membranes</title>`);
    expect(manifest).toContain(`<item identifier="I_1" identifierref="WL_1"><title>Resource cells</title></item>`);
    expect(manifest).toContain(`<item identifier="I_2" identifierref="WL_2"><title>Resource osmosis</title></item>`);
    expect(manifest).toContain(`<resource identifier="WL_2" type="imswl_xmlv1p3"><file href="WL_2/weblink.xml"/></resource>`);
    expect(files.get("WL_1/weblink.xml")).toContain(`<url href="https://open-lessons.example/cells"/>`);
    expect(files.get("WL_2/weblink.xml")).toContain(`<url href="https://open-lessons.example/osmosis"/>`);
  });
});

/**
 * A Thin CC with a nested module, an LTI tool and a hostile title, as a cartridge reader returns it:
 * "Week 1" holds Producers, Extra (holding Plants) and a Simulator tool; "Week 2" holds Consumers.
 */
const NESTED_CARTRIDGE: CartridgeImport = {
  fileName: "course.imscc",
  manifestIdentifier: "M_1",
  metadata: { title: "Ecosystems (synthetic)", standards: [] },
  outline: [
    {
      kind: "module",
      identifier: "I_WEEK1",
      title: "Week 1",
      children: [
        { kind: "link", identifier: "I_A", linkId: "lnk-1" },
        { kind: "module", identifier: "I_DEEP", title: "Extra", children: [{ kind: "link", identifier: "I_B", linkId: "lnk-2" }] },
        { kind: "tool", identifier: "I_SIM" },
      ],
    },
    { kind: "module", identifier: "I_WEEK2", title: "Week 2", children: [{ kind: "link", identifier: "I_C", linkId: "lnk-3" }] },
  ],
  links: [
    { id: "lnk-1", title: "Producers", url: "https://open-lessons.example/producers", metadata: { standards: [], keywords: [] } },
    { id: "lnk-2", title: "<script>alert(1)</script>", url: "https://open-lessons.example/plants", metadata: { standards: [], keywords: [] } },
    { id: "lnk-3", title: "Consumers", url: "https://open-lessons.example/consumers", metadata: { standards: [], keywords: [] } },
  ],
};

const released = (resourceId: string, use: ReleasedLink["use"] = "link"): ReleasedLink => ({ resourceId, version: "1.0.0", use });

describe("Thin CC to OCS", () => {
  it("makes a unit of each top-level module holding its released links, and lists what it could not carry", async () => {
    const record = NESTED_CARTRIDGE;
    const { files, pkg, losses } = await ocsFromCartridge(record, {
      packageId: "northfield.example/ecosystems",
      version: "1.0.0",
      language: "en",
      released: new Map([["lnk-1", released("rsc_producers")], ["lnk-2", released("rsc_plants", "embed")]]),
    });
    expect(pkg.manifest).toMatchObject({ id: "northfield.example/ecosystems", title: "Ecosystems (synthetic)", outline: [{ kind: "unit", unit: "u-i-week1" }] });
    expect(pkg.units.get("u-i-week1")).toMatchObject({ title: "Week 1", items: [{ kind: "resource", ref: "lnk-1" }, { kind: "resource", ref: "lnk-2" }] });
    // The hostile title is replaced, so the package stays plain text and readable.
    expect(pkg.resources.get("lnk-2")).toMatchObject({ title: "Untitled", use: "embed", release: { resourceId: "rsc_plants" } });
    expect(Object.keys(files).toSorted()).toStrictEqual(["ocs.json", "resources/lnk-1.json", "resources/lnk-2.json", "units/u-i-week1.json"]);
    expect(losses).toStrictEqual([
      { kind: "nested-module-flattened", at: "I_DEEP" },
      { kind: "title-replaced", at: "lnk-2" },
      { kind: "lti-tool", at: "I_SIM" },
      { kind: "link-not-released", at: "I_C" },
    ]);
  });

  it("refuses a cartridge none of whose links is released", async () => {
    const record = NESTED_CARTRIDGE;
    await expect(ocsFromCartridge(record, { packageId: "northfield.example/ecosystems", version: "1.0.0", language: "en", released: new Map() }))
      .rejects.toMatchObject({ code: "validation-failed" });
  });
});
