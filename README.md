# Open Course Standard (OCS)

**A Git-native, vendor-neutral specification for creating, composing, releasing, and advancing educational works.**

OCS describes *educational resources*, not a particular learning-management system or an institution's database. A course can be a three-file repository, a package in a monorepo, or a composition of independent Git repositories and packages. It works for middle school, secondary school, university, graduate research, and self-directed education.

> **Status:** 0.1 working draft. Schemas, RFCs, and the reference CLI are experimental and **not a published interoperability certification**. Normative language in RFCs describes the proposed conformance contract.

## Core principles

- **A resource is not a file path.** Stable package-scoped IDs identify lessons, laboratories, concepts, datasets, rubrics, and assessments across moves and forks.
- **A course is a composition.** Learning experiences select resources from independently maintained works. Git submodules are a useful *transport*, not the educational ontology.
- **Releases are pinned.** Semver is for discovery; exact content digests and dependency locks preserve approved releases.
- **Education-level neutral.** Grades, academic credits, semesters, grading scales, and institutions are optional contextual mappings, never core requirements.
- **Students can contribute back.** Authorized snapshots, learner workspaces, proposals, upstream review, and new releases must remain distinct from confidential assessments and grades.
- **Safety by construction.** Importing a repository does not grant access to confidential content or permission to execute code or agent instructions.
- **Agents and LMSs are adapters.** OpenAPI, CLI, MCP, CASE, LTI, QTI, and Common Cartridge interoperability add capabilities without defining the core format.

## Repository structure

| Location | Contents |
| --- | --- |
| [`rfcs/`](rfcs/) | Proposed normative specifications, BCP 14 language, security and conformance boundaries |
| [`src/ocs/schemas/v0.1/`](src/ocs/schemas/v0.1/) | Draft JSON Schema 2020-12 definitions |
| [`src/ocs/`](src/ocs/) | Python reference validator, dependency inspector, graph reader and local lock generator |
| [`examples/`](examples/) | Minimal, secondary, undergraduate, graduate, and composed courses |
| [`tests/`](tests/) | CLI and validation regression tests |
| [`docs/`](docs/) | Design rationale, decisions and implementation roadmap |

## Quick start

Python 3.11+ is used for the **reference implementation only**; no OCS file requires Python.

```bash
python -m pip install -e .
ocs validate examples/minimal-course
ocs inspect examples/secondary-biology
ocs graph examples/federated-watershed
ocs verify examples/federated-watershed
python -m unittest discover -s tests -v
```

Or start a minimal OCS course with two files:

```text
my-course/
  ocs.yaml
  introduction.md
```

```yaml
specVersion: "0.1"
kind: Course
id: org.example/my-course
version: "1.0.0"
metadata:
  title: My Course
resources:
  - id: introduction
    kind: Lesson
    path: introduction.md
entrypoints: [introduction]
```

## What the v0.1 tools actually support

`ocs validate` checks strict YAML, manifests, local resources, composition references, and local package dependencies. `ocs inspect` and `ocs graph` examine a package without hosting dependencies. `ocs lock` / `ocs verify` create and verify **prototype local-source** SHA-256 inventories. Remote Git and registry resolution, gitlink verification, package signing, protected assessment storage, LTI, and MCP services are RFC work, **not implemented in this CLI**. The lock algorithm is explicitly provisional; do not treat it as a final cross-implementation hashing standard.

## Specification map

Start at the [RFC index](rfcs/README.md). [Architecture](docs/architecture.md) explains the domain boundaries; [Roadmap](docs/roadmap.md) identifies what remains before v1.0 interoperability. Contributions are welcome through issues and pull requests under [CONTRIBUTING.md](CONTRIBUTING.md).

## References

OCS uses the requirement-keyword conventions of [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174), and is designed to map to existing standards rather than replace them: [JSON Schema](https://json-schema.org/specification), [LTI](https://www.1edtech.org/standards/lti), [CASE](https://www.1edtech.org/standards/case), [QTI](https://www.1edtech.org/standards/qti/index), [Common Cartridge](https://www.1edtech.org/standards/cc), and [W3C PROV](https://www.w3.org/TR/prov-o/).

## License

Apache-2.0 for the current repository, including reference code and specification drafts. This does not license third-party educational content imported by an OCS course; individual resources retain their own licenses and rights metadata.
