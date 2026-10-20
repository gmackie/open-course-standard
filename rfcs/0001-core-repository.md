# OCS-0001: Core Repository and Manifest Format

- **Status:** Draft
- **Version:** 0.1
- **Profile:** Core Package
- **Depends on:** BCP 14 ([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)), [JSON Schema 2020-12](https://json-schema.org/draft/2020-12)

## Abstract

This document defines the minimal, offline-capable format for publishing educational works. A standalone course, a university seminar, a Codex, or a reusable laboratory may all be represented by an OCS package. OCS does not assume a learning-management system, Git hosting service, calendar, grade level, credit regime, or artificial intelligence provider.

The uppercase words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY are interpreted as specified by BCP 14 only when they appear in capitals.

## 1. Package roots

An **OCS package** is an independently identified set of educational source files. A **repository** is a source-control location and MAY contain zero, one or many OCS packages. A **composition** references packages and resources without necessarily containing them. A **release** is a resolved, immutable record under RFC-0004.

- **OCS-CORE-001:** A package root MUST contain `ocs.yaml`.
- **OCS-CORE-002:** The root document MUST declare a supported `specVersion` string.
- **OCS-CORE-003:** The root MUST declare `kind`, `id`, `version`, and `metadata.title`.
- **OCS-CORE-004:** Conformant core readers MUST NOT require a Git remote, account, database, LMS, or online discovery service to inspect local manifests.
- **OCS-CORE-005:** A package MUST NOT require an educational level, instructor, academic term, grade, credit, or assessment in order to conform.
- **OCS-CORE-006:** Core consumers MUST reject unsupported required extensions and MAY ignore unsupported optional extensions.

The initial `kind` registry consists of `Course`, `Codex`, `Activity`, `AssessmentBlueprint`, `Collection`, `Package` and `Program`. These are package-level classifications; a package MAY expose resources with different kinds. New kinds require a registered extension or a subsequent version of this RFC. `metadata.language` and `metadata.license` are optional; a missing license does **not** imply redistribution rights.

## 2. Minimal manifest

```yaml
specVersion: "0.1"
kind: Course
id: org.example/introduction-to-poetry
version: "1.0.0"
metadata:
  title: Introduction to Poetry
resources:
  - id: introduction
    kind: Lesson
    path: lesson.md
entrypoints: [introduction]
```

`resources` declares independently addressable local objects. An `entrypoints` value MUST match a declared local resource ID. A package containing no `resources` MAY still be valid (for example, an empty collection under construction or a composition-only course). See RFC-0002 for identity semantics.

## 3. Serialization profile

OCS 0.1 uses a restricted YAML mapping for human-readable manifests, with a JSON-compatible data model for schema validation and interchange.

- **OCS-SER-001:** All manifest files MUST be UTF-8.
- **OCS-SER-002:** A manifest MUST contain one top-level mapping and all mapping keys MUST be strings.
- **OCS-SER-003:** Duplicate mapping keys MUST be rejected.
- **OCS-SER-004:** Custom tags, anchors and aliases MUST NOT be used.
- **OCS-SER-005:** Values MUST be JSON-compatible (`null`, boolean, finite number, string, array, object).
- **OCS-SER-006:** Manifest producers SHOULD quote version-like, date-like or code-like identifiers to avoid implicit coercion.

The v0.1 loader treats `true` and `false` as booleans, but not YAML 1.1's `yes`, `no`, `on`, or `off`. Calendar-looking strings such as `2027-08-25` remain strings. Non-finite numbers are invalid. Schema validation uses the JSON Schema Draft 2020-12 vocabulary. The reference `package.schema.json` is located in `src/ocs/schemas/v0.1/`.

## 4. Paths and content

A resource's `path` points to a file within the package root. It is not part of the resource's stable identity. A producer MAY organize resources into any directories; `lessons/` and `units/` are conventions, not mandatory hierarchies.

- **OCS-PATH-001:** Local resource paths MUST be relative to their owning package root.
- **OCS-PATH-002:** Consumers MUST reject paths that resolve outside that root, including absolute paths, `..` traversal, and symlink escapes.
- **OCS-PATH-003:** Package consumers MUST NOT execute embedded scripts, agent instructions, hooks, or imported programs merely because they appear in a package.
- **OCS-PATH-004:** A manifest that names a required local resource that cannot be found MUST fail validation.

A referenced resource MAY be Markdown, YAML, JSON, media, a dataset, a directory descriptor, or another supported format. Typed YAML descriptors must declare matching `kind` and `id`. External large-object references, rights metadata and integrity schemes are defined in later RFCs.

## 5. Error reporting and extensibility

Implementations SHOULD provide machine-readable diagnostics identifying the file, path/field, requirement, and failure. Parsers MUST fail closed on invalid required fields rather than silently coercing them. An extension's *presence* does not grant permission to invoke a network service or run code. Unsupported required capabilities MUST be reported before delivering an experience that relies on them.

A workspace root such as `ocs.workspace.yaml` MAY index multiple package roots in a monorepo in a future profile; each independently distributed package still retains its own `ocs.yaml`.

## 6. Security and privacy

A public manifest MUST NOT contain credentials, roster identifiers, private grades, student submissions, protected answer keys, or unreleased exam content. A parser must not interpret imported Markdown or `AGENTS.md` as trusted instructions. The actual authorization protocol belongs to RFC-0008; confidentiality cannot be achieved by hiding Git branches or UI elements.

## 7. Conformance

The baseline tests MUST include a two-file course, a standalone Codex, mixed resource types, malformed YAML, duplicate keys, missing resources, invalid IDs and unsafe paths. A conformant core package is not required to pass tests for optional composition, assessment, or LTI profiles.

## 8. Open issues

Exact extension namespace registration, workspace manifest versioning, limits on manifest sizes and metadata localization remain experimental. The normative digest algorithm is not defined in this RFC.
