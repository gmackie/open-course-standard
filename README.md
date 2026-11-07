# Open Course Standard (OCS)

**An open, vendor-neutral format for courses that teachers build from reusable parts.**

An OCS course package is a small set of JSON files: a manifest, units, references to activities
and resources, and notes for teachers and students. A course can include other course packages
as **modules**, then hide, reorder and rename what it includes without copying it. A
**lockfile** records the exact version and content digest of every module, so the same course
always composes to the same outline, byte for byte, on any machine.

**OCS 1.1** is the current version. It was first published as the EducateOS "Open Course
Specification" and is now maintained here as an independent standard. EducateOS is one
implementation of it, and its twelve sample courses are among the [examples](examples/).

| | |
| --- | --- |
| Specification | [spec/ocs-1.1.md](spec/ocs-1.1.md) |
| JSON Schemas | [schemas/1.1/](schemas/) |
| Reference implementation and CLI | [packages/ocs](packages/ocs/) (`@open-course-standard/ocs`, TypeScript, Node.js 20+ and browsers) |
| Conformance suite | [conformance/](conformance/) (91 cases, a runner for any implementation) |
| Examples | [examples/](examples/) (kindergarten to graduate school) |
| Why it looks like this | [docs/decisions.md](docs/decisions.md) |

## What OCS is for

- **Modular composition.** Include another publisher's units without copying them, and adapt
  them with overrides that never touch the original.
- **Determinism.** The same manifest, published packages and lockfile always give
  byte-identical lockfiles and identical composed outlines. The conformance suite tests this byte
  for byte.
- **Integrity.** Every package is identified by ID, version and content digest, and can be signed
  by its publisher with a key the destination approves. Content that changes after publication
  is refused.
- **Rights that only narrow.** Including a module can restrict how its resources are used, never
  widen it.
- **Data only.** A package holds no executable code, so reading, composing or importing one can
  never run anything.
- **Level-neutral core.** A package needs no grade level, term, credit system or institution.

OCS is not a learning platform, a gradebook or a registry, and it holds no student data.

## Git is an implementation detail

Packages are often stored in Git, but **nothing in the format depends on Git**, and teachers never
need to see it. A package store may keep packages in a Git repository (a package directory is a
natural repository), in a database or in object storage. The format and its tools describe
changes in course words: module, version, publish, update.

## A package at a glance

```
biology-9/
  ocs.json                 the manifest
  ocs.lock                 the lockfile, written at publication
  units/cells.json         one unit per file
  activities/lab.json      activity references (district-local or portable)
  resources/diagram.json   resource release references and the use made of them
  codex/key.json           notes: student overviews, teacher guides, answer keys
```

```json
{
  "specVersion": "1.0",
  "id": "northfield.example/biology-9",
  "version": "1.0.0",
  "title": "Biology 9",
  "language": "en",
  "standards": [],
  "modules": [
    { "name": "safety", "package": "labsafe.example/lab-safety", "range": "^1.2.0", "rights": "embed" }
  ],
  "outline": [{ "kind": "unit", "unit": "cells" }, { "kind": "module", "module": "safety" }],
  "overrides": [
    { "kind": "rename", "target": { "modules": ["safety"], "unit": "rules" }, "title": "Lab safety" }
  ]
}
```

## Try it

This repository uses [pnpm](https://pnpm.io) and Node.js 22+ for development:

```sh
corepack enable
pnpm install
pnpm build

pnpm ocs validate examples/level-neutral examples/educateos
pnpm ocs inspect examples/level-neutral/example.org/watershed-science --store examples/level-neutral
pnpm ocs lock examples/level-neutral/example.org/watershed-science --store examples/level-neutral --check
pnpm ocs verify examples/educateos          # checks every signed bundle against the publisher's key
pnpm conformance                            # the conformance suite against the reference implementation

pnpm check                                  # everything CI runs
```

The `ocs` commands are `validate`, `inspect`, `lock`, `verify`, `compose` and `export-thin-cc`
([details](packages/ocs/README.md)). The npm package `@open-course-standard/ocs` is ready to
publish but **not yet published**.

## For implementers

1. Read the [specification](spec/ocs-1.1.md). Section 21 defines three conformance classes:
   **producer**, **consumer** and **composer**.
2. Validate structure with the [JSON Schemas](schemas/). Their `$id`s are stable URLs.
3. Write a small adapter for the [conformance suite](conformance/README.md) and run
   `node conformance/run.mjs --adapter "<your command>"`.

## Status and governance

OCS is a published draft standard with provisional governance: Graham Mackie is the steward, and
normative changes go through public RFCs ([GOVERNANCE.md](GOVERNANCE.md)). It is not the product of
a standards body. Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md) and
[SECURITY.md](SECURITY.md). The [changelog](CHANGELOG.md) records every change.

## License

- Code (`packages/`, the conformance runner, scripts, CI): **Apache-2.0**.
- Specification, schemas, conformance fixtures, examples and documentation: **CC-BY-4.0**.
- The EducateOS sample courses keep their Apache-2.0 license.

See [LICENSE](LICENSE). A course package carries its own publisher's rights; nothing here
licenses the content of a package you did not get from this repository.
