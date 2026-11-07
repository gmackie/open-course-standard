# Changelog

All notable changes to the Open Course Standard, its schemas and its reference implementation.
Specification versions are tagged `spec-vX.Y`. The reference implementation follows semantic
versioning on its own.

## Unreleased

### Specification

- OCS 1.1 published as the vendor-neutral Open Course Standard (`spec/ocs-1.1.md`). Same format
  as the EducateOS "Open Course Specification" 1.1: format versions, signing contexts and the
  bundle format are unchanged. Adds RFC 2119 language, an exact canonical JSON and digest
  definition, a normative resolution procedure, producer/consumer/composer conformance classes,
  problem kinds, and a non-normative implementations appendix for EducateOS-specific notes.

### Schemas

- JSON Schema 2020-12 for all 13 OCS documents in `schemas/1.1/`, generated from the reference
  implementation's validators, with stable `$id` URLs. The plain-text rule is expressed as a
  case-folded `not`/`pattern`.

### Reference implementation (`@open-course-standard/ocs` 1.1.0, not yet published to npm)

- Standalone port of `@educateos/ocs`: no Cloudflare or EducateOS dependency, web-standard APIs
  only (Node.js 20+ and browsers), Zod the only dependency.
- `ocs` CLI: `validate`, `inspect`, `lock`, `verify`, `compose`, `export-thin-cc`.
- Not ported: the Durable Object library (Cloudflare-specific), and the adapters to the EducateOS
  curriculum service (`planInstallations`, `installCourse`, `templateInputFor`). The
  `CourseInstallTarget` installation plan replaces them.

### Conformance suite

- `conformance/`: 91 cases with expected results (37 package, 13 export, 22 resolve with
  byte-identical lockfiles, 6 compose, 7 bundle, 6 publication), and `run.mjs`, a runner that
  tests any implementation through a one-request-per-process JSON adapter. The reference
  implementation's adapter is `ocs conformance-adapter`.

### Examples

- `examples/level-neutral/`: the five v0.1 examples converted to OCS 1.1 (poetry, secondary
  biology with a portable assessment, undergraduate lab, graduate seminar, and a course composed
  from two publishers' packages).
- `examples/educateos/`: EducateOS's twelve sample courses, 270 activity exports and 13 signed
  bundles, copied under their Apache-2.0 license.

### Repository

- Licensing split: code under Apache-2.0, specification, schemas, fixtures, examples and
  documentation under CC-BY-4.0 ([LICENSE](LICENSE)).
- Provisional governance with Graham Mackie as steward, contribution and security policies,
  carried over and adapted from the v0.1 proposal.
- Design decision log ([docs/decisions.md](docs/decisions.md)): why OCS 1.1 is the core, what
  was kept from v0.1, and what is deferred.
- CI runs on every pull request.

## History before this repository

- **OCS 1.1** (2026-11-04), published as the EducateOS "Open Course Specification": portable
  activity references and activity definition exports, publication signatures for exports, and
  course bundles.
- **OCS 1.0** (2026-10-20), EducateOS "Open Course Specification": package layout, manifest,
  units, activity, resource and Codex note entries, version ranges, the package digest, the
  resolver and lockfile, composition with overrides, rights propagation, and publisher
  signatures.
- **OCS v0.1** (2026-11, proposal, not adopted as the core): a Git-native YAML draft with nine
  RFCs, proposed in [PR #1](https://github.com/gmackie/open-course-standard/pull/1). See
  [docs/decisions.md](docs/decisions.md) for what was carried forward.
