# OCS JSON Schemas

JSON Schema (draft 2020-12) for every document OCS 1.1 defines. The schemas are normative for
structure; the [specification](../spec/ocs-1.1.md) states the rules a schema cannot express, such
as references between files, uniqueness within lists, digests and signatures.

| Schema | Document | Spec |
| --- | --- | --- |
| [ocs.schema.json](1.1/ocs.schema.json) | package manifest, `ocs.json` | §6 |
| [ocs-lock.schema.json](1.1/ocs-lock.schema.json) | lockfile, `ocs.lock` | §11 |
| [unit.schema.json](1.1/unit.schema.json) | `units/<id>.json` | §7.1 |
| [activity.schema.json](1.1/activity.schema.json) | `activities/<id>.json` | §7.2 |
| [resource.schema.json](1.1/resource.schema.json) | `resources/<id>.json` | §7.3 |
| [codex-note.schema.json](1.1/codex-note.schema.json) | `codex/<id>.json` | §7.4 |
| [activity-export.schema.json](1.1/activity-export.schema.json) | activity definition export | §14 |
| [bundle.schema.json](1.1/bundle.schema.json) | bundle | §16 |
| [publisher.schema.json](1.1/publisher.schema.json) | publisher key document, `publisher.json` | §15.1 |
| [trust.schema.json](1.1/trust.schema.json) | trust configuration | §15.1 |
| [package-publication.schema.json](1.1/package-publication.schema.json) | package publication statement | §15.2 |
| [activity-export-publication.schema.json](1.1/activity-export-publication.schema.json) | export publication statement | §15.2 |
| [signed-envelope.schema.json](1.1/signed-envelope.schema.json) | signature envelope | §15.2 |

Each schema's `$id` is its stable URL,
`https://raw.githubusercontent.com/gmackie/open-course-standard/main/schemas/1.1/<file>`.

The schemas are **generated** from the reference implementation's validators
(`pnpm --filter @open-course-standard/ocs schemas`), and CI fails if they are stale. Every example
and conformance fixture is validated against them. Do not edit them by hand.

Licensed CC-BY-4.0.
