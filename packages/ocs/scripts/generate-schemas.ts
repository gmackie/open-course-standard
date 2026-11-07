// Generates the JSON Schemas in schemas/1.1/ from the reference implementation's Zod validators, so
// the two cannot drift. `--check` fails if a committed schema differs from what would be generated.
// Run with `pnpm --filter @open-course-standard/ocs schemas`. SPDX-License-Identifier: Apache-2.0
// (the generated schemas are CC-BY-4.0, as the repository's LICENSE says).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ActivityExport } from "../src/activity-export.ts";
import { OcsBundle } from "../src/bundle.ts";
import { formatJson } from "../src/json.ts";
import { SignedEnvelope } from "../src/keys.ts";
import { OcsActivity, OcsCodexNote, OcsLock, OcsManifest, OcsResource, OcsUnit } from "../src/schema.ts";
import { ActivityExportPublication, PackagePublication, PublisherKeys, PublisherTrust } from "../src/signatures.ts";

/** Where the schemas are published. Stable: implementations may fetch or vendor them by this URL. */
export const SCHEMA_BASE = "https://raw.githubusercontent.com/gmackie/open-course-standard/main/schemas/1.1/";

const SPEC = "https://github.com/gmackie/open-course-standard/blob/main/spec/ocs-1.1.md";

interface SchemaEntry {
  file: string;
  schema: z.ZodType;
  title: string;
  section: string;
  description: string;
}

export const SCHEMAS: readonly SchemaEntry[] = [
  { file: "ocs.schema.json", schema: OcsManifest, title: "OCS package manifest (ocs.json)", section: "6", description: "The manifest of an OCS package." },
  { file: "ocs-lock.schema.json", schema: OcsLock, title: "OCS lockfile (ocs.lock)", section: "11", description: "The lockfile of an OCS course: the exact version and digest of every package it includes." },
  { file: "unit.schema.json", schema: OcsUnit, title: "OCS unit (units/<id>.json)", section: "7.1", description: "A unit: an ordered sequence of items taught together." },
  { file: "activity.schema.json", schema: OcsActivity, title: "OCS activity reference (activities/<id>.json)", section: "7.2", description: "A pointer to an activity definition, district-local or portable." },
  { file: "resource.schema.json", schema: OcsResource, title: "OCS resource reference (resources/<id>.json)", section: "7.3", description: "A resource release and the use the package makes of it." },
  { file: "codex-note.schema.json", schema: OcsCodexNote, title: "OCS Codex note (codex/<id>.json)", section: "7.4", description: "Context for a course: a student overview, a teacher guide or an answer key." },
  { file: "activity-export.schema.json", schema: ActivityExport, title: "OCS activity definition export", section: "14.2", description: "A portable activity definition: its template inputs, rubric, alignments and readings." },
  { file: "bundle.schema.json", schema: OcsBundle, title: "OCS bundle", section: "16", description: "A course, the packages it includes and the exports they name, with digests and signatures, in one document." },
  { file: "publisher.schema.json", schema: PublisherKeys, title: "OCS publisher key document (publisher.json)", section: "15.1", description: "A publisher's public keys, for destinations to approve." },
  { file: "trust.schema.json", schema: PublisherTrust, title: "OCS trust configuration", section: "15.1", description: "The publisher keys a destination approved, and its own publishing domains." },
  { file: "package-publication.schema.json", schema: PackagePublication, title: "OCS package publication statement", section: "15.2", description: "What a publisher signs for one package version." },
  { file: "activity-export-publication.schema.json", schema: ActivityExportPublication, title: "OCS activity export publication statement", section: "15.2", description: "What a publisher signs for one activity export version." },
  { file: "signed-envelope.schema.json", schema: SignedEnvelope, title: "OCS signature envelope", section: "15.2", description: "A signed publication statement: the statement, its Ed25519 signature and the signing key's ID." },
];

const NOTE =
  "Normative for structure (OCS 1.1 §1). Rules a schema cannot express, such as references between files, uniqueness within lists, and the digest and signature checks, are stated in the specification.";

/** One schema document, as committed. */
export function generate(entry: SchemaEntry): string {
  const generated = z.toJSONSchema(entry.schema, { target: "draft-2020-12", io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  const { $schema, ...body } = generated;
  return formatJson({
    $schema,
    $id: `${SCHEMA_BASE}${entry.file}`,
    title: entry.title,
    description: `${entry.description} See ${SPEC} §${entry.section}. ${NOTE}`,
    $comment: "Generated from the reference implementation (packages/ocs/scripts/generate-schemas.ts); do not edit. License: CC-BY-4.0.",
    ...body,
  });
}

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../../schemas/1.1");

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes("--check");
  const stale: string[] = [];
  mkdirSync(OUT, { recursive: true });
  for (const entry of SCHEMAS) {
    const path = join(OUT, entry.file);
    const text = generate(entry);
    if (check) {
      let current = "";
      try {
        current = readFileSync(path, "utf8");
      } catch {
        // missing counts as stale
      }
      if (current !== text) stale.push(entry.file);
    } else writeFileSync(path, text);
  }
  if (stale.length > 0) {
    console.error(`schemas/1.1 is stale: ${stale.join(", ")}. Run \`pnpm --filter @open-course-standard/ocs schemas\`.`);
    process.exit(1);
  }
  console.log(check ? `schemas/1.1: ${SCHEMAS.length} schemas are current` : `wrote ${SCHEMAS.length} schemas to schemas/1.1`);
}
