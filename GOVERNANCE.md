# Governance (provisional)

OCS is an open specification maintained in this repository. It is **not** yet the product of a
standards body such as IETF, W3C, ISO or 1EdTech, and nothing here claims that status.

## Steward

Until a broader governance body exists, the project has one steward: **Graham Mackie**
(GitHub [@gmackie](https://github.com/gmackie)). The steward:

- merges or declines pull requests and decides when a specification version is released;
- appoints and removes maintainers, who may review and merge non-normative changes
  (documentation, tooling, fixtures that do not change expected results);
- records every normative decision, with the alternatives considered, in
  [docs/decisions.md](docs/decisions.md) or in the RFC that proposed it.

The steward intends to move OCS to multi-party governance (for example a steering group of
implementers, or a host foundation) once there are independent implementations. That move will
be proposed as an RFC and announced in the changelog.

## How the specification changes

Normative changes go through a public RFC: a pull request that adds `rfcs/NNNN-title.md`.
An RFC moves through these states, recorded in its header:

**Proposal → Draft → Candidate → Accepted** (or **Withdrawn**).

- A **Draft** states the problem, the specification text, the security, privacy and
  compatibility consequences, and at least one example.
- A **Candidate** also has schema changes, conformance fixtures for every new MUST, and an
  implementation in the reference implementation or an implementability review by someone
  other than the author.
- An **Accepted** RFC is merged into `spec/` in a released version.

Disagreements are recorded as alternatives in the RFC, not silently dropped.

## Versions and compatibility

- The format is versioned by `specVersion` (`"1.0"`, `"1.1"`). A **minor** version may add
  optional fields or new forms. Because every object is strict, an older reader refuses a
  package that uses them instead of silently ignoring them, and the newer version says when a
  package must declare it. A **major** version may change meaning and must ship a migration.
- Published identifiers that appear on the wire, such as signing contexts and the bundle
  format name, never change within a major version, even when they carry a historical name.
- Released specification versions are tagged `spec-vX.Y` and are never edited afterwards,
  except for errata that do not change conformance. Errata are listed in the changelog.

## Conduct and privacy

Discussion happens in public issues and pull requests. Be respectful and assume good faith.
Never post private student information, real grades, unreleased assessments, credentials or
keys in an issue, pull request or fixture.
