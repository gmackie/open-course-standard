# Changelog

All notable changes to the Open Course Standard, its schemas and its reference implementation.
Specification versions are tagged `spec-vX.Y`. The reference implementation follows semantic
versioning on its own.

## Unreleased

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
