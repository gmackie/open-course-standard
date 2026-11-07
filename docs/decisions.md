# Design decisions

This log records the decisions that shaped the Open Course Standard as published in this
repository, with the alternatives that were considered. New decisions are added at the end.

## D1. OCS 1.1 is the normative core (2026-11-07)

**Context.** Two drafts used the name "OCS" in late 2026:

- **OCS v0.1**, proposed in this repository in
  [PR #1](https://github.com/gmackie/open-course-standard/pull/1) ("Open Course Standard"). It is
  a Git-native, YAML-based draft with nine RFCs, a Python reference CLI and five level-neutral
  examples.
- **OCS 1.0/1.1**, the EducateOS "Open Course Specification" (RFC 0001 in
  [gmackie/educate-os](https://github.com/gmackie/educate-os), implemented by `@educateos/ocs`).
  It is a JSON package format with a deterministic resolver, a lockfile, composition with
  overrides, rights propagation, publisher signatures and portable activities, and twelve
  published sample courses.

**Decision.** The project owner decided to merge the two, with OCS 1.1 as the normative core.
This repository is the published home of the standard. EducateOS is one implementation.

**Why 1.1.**

1. **It is implemented and in use.** 1.1 has a complete reference implementation with tests,
   real courses signed by a real publisher, and a district installation path. v0.1 was a
   draft whose own README said its lock algorithm was provisional and that remote resolution,
   signatures and Git verification were not implemented.
2. **It is deterministic down to the byte.** 1.1 specifies the canonical digest, the
   resolution algorithm and the lockfile bytes. Two implementations can be tested against each
   other. v0.1 left its digest and lock format open.
3. **It is safer by construction.** 1.1 packages are data at fixed paths with strict objects
   and plain text, so there is nothing to execute. v0.1's free-form file layout (Markdown,
   YAML descriptors and arbitrary paths) needed path-traversal and symlink rules and still
   admitted arbitrary files.
4. **It keeps Git out of teachers' way.** 1.1 treats version control as a choice of the
   package store. v0.1 was "Git-native": it modelled composition on Git submodules and
   gitlinks. Many of the people OCS is for (teachers and curriculum coordinators) should never
   need to understand a submodule pointer.
5. **Keeping the existing identifiers keeps existing courses valid.** `specVersion` stays
   `"1.0"`/`"1.1"`, and the signing contexts and the bundle format name keep their published
   values, so every course already published under 1.0 or 1.1 is a valid OCS course here.

**Name.** The public name is **Open Course Standard (OCS)**. The specification says it was
previously published as the EducateOS "Open Course Specification".

## D2. What was taken from v0.1

| From v0.1 | Where it is now |
| --- | --- |
| Provisional governance, RFC lifecycle, contribution and security policies | [GOVERNANCE.md](../GOVERNANCE.md), [CONTRIBUTING.md](../CONTRIBUTING.md), [SECURITY.md](../SECURITY.md), adapted to 1.1 and with the steward named |
| Level neutrality: one format from middle school to doctoral research | A design goal of the specification, and the five v0.1 examples converted to 1.1 (poetry, secondary biology, undergraduate lab, graduate seminar, federated watershed) |
| BCP 14 (RFC 2119 / RFC 8174) requirement language and testable requirements | Used throughout `spec/`, with producer, consumer and composer conformance classes |
| "Importing content is not permission to execute it" | The 1.1 data-only rule, unchanged |
| Separating package dependencies from educational relations | 1.1 modules are structural; nothing in a module edge asserts a prerequisite |
| Conformance fixtures as part of the standard | `conformance/`, with a runner any implementation can use |
| Mapping to, not replacing, existing standards (Common Cartridge, CASE, LTI, QTI) | The specification's "relation to other formats" section |
| Machine-readable diagnostics | The reference implementation's structured problems, and the conformance suite's problem kinds |

## D3. What v0.1 proposed that is not in 1.1 (deferred to future RFCs)

These ideas are worth having but are not part of OCS 1.1. Each will need its own RFC, with
fixtures, before it can become normative.

| v0.1 idea | Status | Notes for a future RFC |
| --- | --- | --- |
| **Progressive disclosure** (v0.1 RFC-0008): student-requested access to future material, policy vocabulary, disclosure audit | Deferred | 1.1 has one disclosure rule: Codex note `visibility` (`students` or `teacher-only`), and answer keys are always teacher-only. Runtime disclosure policy belongs to delivery platforms and may become an optional runtime profile. |
| **Learner workspaces and student contributions** (v0.1 RFC-0007): sanitized forks, contribution review, publishing student work | Deferred | 1.1 keeps all student data out of packages. A contribution profile would define how a reviewed contribution becomes a new package version without leaking teacher-only history. |
| **MCP, OpenAPI and CLI capability bindings** (v0.1 RFC-0009) | Deferred | A runtime-interoperability profile. The rule that imported text is data, never instructions, already applies. |
| **LTI profile** (v0.1 RFC-0009) | Deferred | 1.1 treats LTI tools as resources launched through a destination's own registration. Launch configuration and keys never appear in a package. A profile could map Deep Linking to pinned package versions. |
| **Assessment blueprints and evidence records** (v0.1 RFC-0006): blueprint → candidate → approval → release lifecycle, evidence contracts | Partly covered, rest deferred | 1.1 has assessment-role activities, portable activity exports with rubrics and alignments, and teacher-only answer keys. Approval attestations and evidence records are deferred. |
| **Level-neutral educational context** (v0.1 RFC-0005): ISCED or other classified levels, learning goals not tied to K-12 grade bands | Deferred, known gap | In 1.1, `subject` and `gradeBand` are optional on a package, so a graduate course is valid without them. But a portable activity export requires `subject` and `gradeBand`, and the `gradeBand` vocabulary is K-12 (`K`, `7`, `9-12`). The v0.1 undergraduate and graduate examples therefore use notes, not portable activities. A future minor version should add a level-neutral context field. |
| **Git submodule resolution profile** (v0.1 RFC-0003 §5) | Not planned for the core | A package store may use Git, and a store-specific profile may describe how. The core format stays independent of version control. |
| **Provenance edges** (`derivedFrom`, W3C PROV mapping) (v0.1 RFC-0002) | Deferred | 1.1 composition records provenance (package, version, digest, module path) for every composed unit and item. Derivation between packages is not yet expressed. |
| **Workspace manifests for monorepos** (`ocs.workspace.yaml`) | Deferred | The examples here use a simple package-store directory layout, which is not normative. |

## D4. What v0.1 did that 1.1 replaces

| v0.1 | Replaced by | Why |
| --- | --- | --- |
| YAML manifests (`ocs.yaml`) with a restricted YAML profile | Strict JSON files (`ocs.json`, …) | JSON has one data model, no implicit typing (`no` → false) and no anchors or tags to forbid. The digest is defined over canonical JSON. |
| Free-form resource paths (Markdown, media) | Fixed layout of JSON entry files; resources by release reference | Nothing outside the layout can ride along, so there is nothing to execute and nothing to traverse. |
| Provisional file-inventory SHA-256 lock (`.ocs/lock.json`) | The 1.1 package digest and `ocs.lock` | Specified, deterministic and tested byte for byte. |
| Python reference CLI | TypeScript reference implementation and `ocs` CLI (`packages/ocs`) | Ported from the implementation that produced the published courses, and runs in Node.js and browsers. |
| `namespace/name` package IDs with a dotted namespace | `domain/name` package IDs | Nearly the same idea. 1.1 uses a DNS-style publisher domain, which is also the key that signatures are pinned to. |

## D5. Vendor neutrality (2026-11-07)

The 1.1 text in EducateOS described EducateOS runtime components: Durable Object storage, the
curriculum service and Content Studio review. The published specification keeps only what an
independent implementation needs. EducateOS-specific notes moved to the specification's
non-normative "Implementations" appendix.

Some 1.1 wire-format details came from EducateOS and are kept unchanged so that existing
courses stay valid:

- the `subject` vocabulary and the `gradeBand` grammar;
- the district-local identifier grammars (`rsc_…` resource IDs, `adf_…` activity definition
  IDs, `rbr_…` rubric IDs);
- the template vocabulary of portable activity exports;
- the signing contexts `educateos-ocs/v1\0package-publication` and
  `educateos-ocs/v1\0activity-export-publication`, and the bundle format name
  `educateos.ocs-bundle.v1`.

The specification defines them neutrally. Generalizing any of them is a format change and
needs an RFC.

## D6. Repository tooling (2026-11-07)

- **pnpm** workspaces, pinned through `packageManager`. The EducateOS implementation is a pnpm
  monorepo package, and pnpm's strict dependency layout catches undeclared dependencies in the
  reference implementation.
- **TypeScript and Zod** for the reference implementation, as in `@educateos/ocs`. The JSON
  Schemas are generated from the Zod validators, then tested against the implementation on
  every fixture and example.
- The reference package is named `@open-course-standard/ocs`. It is ready to publish to npm but
  has not been published yet. Publishing needs the steward's approval.

## D7. EducateOS keeps its own implementation for now (2026-11-07)

EducateOS was not changed while this repository was set up. Follow-up SCHO-348 (EducateOS
tracker) covers pointing EducateOS RFC 0001 at this specification, running this conformance suite
against `@educateos/ocs` in EducateOS's CI, and deciding whether `@educateos/ocs` should depend on
`@open-course-standard/ocs` once it is published to npm. Until then, the conformance suite is what
keeps the two implementations equal.
