# Open Course Standard (OCS)

**An open, vendor-neutral format for courses that teachers build from reusable parts.**

An OCS course package is a small set of JSON files: a manifest, units, references to
activities and resources, and notes for teachers and students. A course can include other
course packages as **modules**, then hide, reorder and rename what it includes without
copying it. A lockfile records the exact version and content digest of every module, so the
same course always composes to the same outline, byte for byte, on any machine.

OCS 1.1 is the current version. It was first published as the EducateOS "Open Course
Specification" and is now maintained here as an independent standard. EducateOS is one
implementation of it.

> **Status:** the repository is being assembled in a series of pull requests (tracked as
> SCHO-346). The [specification](spec/ocs-1.1.md) is in place. The JSON Schemas, reference
> implementation, conformance suite and examples follow.

## What OCS is for

- **Modular composition.** Include another publisher's units without copying them, and adapt
  them with overrides that never touch the original.
- **Determinism.** The same manifest, published packages and lockfile always produce
  byte-identical lockfiles and identical composed outlines.
- **Integrity.** Every package is identified by ID, version and content digest, and can be
  signed by its publisher. Content that changes after publication is refused.
- **Rights that only narrow.** Including a module can restrict how its resources are used,
  never widen it.
- **Data only.** A package holds no executable code, so reading, composing or importing one
  can never run anything.
- **Level-neutral by intent.** The core format requires no grade level, term, credit system or
  institution. Educational context fields are optional.

## Git is an implementation detail

OCS is often stored in Git, but **nothing in the format depends on Git**, and teachers never
need to see it. A package store may keep packages in a Git repository (a package directory is
a natural repository), in a database, or in object storage. The format and its tools describe
changes in course words: module, version, publish, update.

## Repository layout

| Path | Contents | License |
| --- | --- | --- |
| `spec/` | The OCS specification | CC-BY-4.0 |
| `schemas/` | JSON Schema 2020-12 for every OCS document | CC-BY-4.0 |
| `packages/ocs/` | TypeScript reference implementation and `ocs` CLI | Apache-2.0 |
| `conformance/` | Fixture packages, expected results and a runner any implementation can use | fixtures CC-BY-4.0, runner Apache-2.0 |
| `examples/` | Example courses from kindergarten to graduate school | CC-BY-4.0 (EducateOS samples: Apache-2.0) |
| `docs/` | Design decisions and history | CC-BY-4.0 |

See [LICENSE](LICENSE) for the details of the split.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [GOVERNANCE.md](GOVERNANCE.md). Security reports
go through [SECURITY.md](SECURITY.md). The reasons behind the current shape of the standard,
including what was kept from the earlier v0.1 proposal and what is deferred, are in
[docs/decisions.md](docs/decisions.md).

This repository uses [pnpm](https://pnpm.io) (see `packageManager` in `package.json`):

```sh
corepack enable
pnpm install
pnpm check
```
