# OCS-0003: Composition, Dependencies and Git Submodules

- **Status:** Draft
- **Version:** 0.1
- **Profile:** Composition
- **Depends on:** OCS-0001, OCS-0002, OCS-0004

The uppercase words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY use the meanings of BCP 14.

## 1. Motivation

A course is an **educational composition**, not necessarily a monorepo. A single course may reference a reusable Codex, independently authored laboratories, simulations, assignments, and assessment blueprints. Multiple courses at different educational levels MAY reference identical source resources, choosing different experiences and evidence requirements.

Git submodules are a strong fit for whole-repository imports: the parent Git tree pins a submodule commit (gitlink); `.gitmodules` records path/URL metadata; the child retains independent version history. **Submodules do not define the educational meaning or permissions of imported content.**

## 2. Two distinct graphs

An OCS composition defines:

1. **Package import graph:** which source packages/releases must resolve;
2. **Educational placement graph:** which resources appear in experiences, in what context, with which optional progression relationships.

An import MUST NOT implicitly mean that every resource in a dependency is released to learners. Educational edges (`requires`, `teaches`, `assesses`, `derivedFrom`, etc.) MUST NOT be confused with package dependency edges.

## 3. Example composition

```yaml
kind: Composition
id: org.example/watershed-science.standard
imports:
  - alias: codex
    package: org.example/watershed-codex
    version: "1.0.0"
    source: {type: local, path: deps/watershed-codex}
placements:
  - id: introduction
    use: {from: self, resource: kickoff}
  - id: runoff
    use: {from: codex, resource: runoff}
    after: [introduction]
```

A `placement` is a context-specific use of a resource. The same resource MAY have multiple placement IDs with different contextual annotations. `after` denotes author-intended sequencing, not an access-control barrier or asserted academic prerequisite. Progression policies belong to RFC-0008.

## 4. Import sources

The v0.1 schema recognizes `local`, `git-submodule`, and `registry` source descriptors. Local sources are relative package paths; a submodule source refers to a checked-out nested Git repository; a registry source supplies a resolver locator. Import aliases are scoped to the composition.

- **OCS-COMP-001:** Each import MUST declare a unique alias, package ID, version constraint, and source description.
- **OCS-COMP-002:** A resolved dependency MUST have the claimed package ID; a mismatch MUST be reported.
- **OCS-COMP-003:** Import paths MUST NOT traverse outside their authorized package root unless an explicit, separately authorized workspace profile permits it.
- **OCS-COMP-004:** A locked release MUST pin the full transitive dependency closure, not merely direct dependencies.
- **OCS-COMP-005:** Required missing dependencies or unsupported required capabilities MUST result in a reported resolution failure.
- **OCS-COMP-006:** Package dependency cycles MUST be rejected in the baseline Composition profile; educational relation cycles need not be rejected.
- **OCS-COMP-007:** A consumer MUST NOT silently update any locked dependency when the upstream Git branch/tag changes.

## 5. Git-submodule profile

When `source.type` is `git-submodule`, a conforming **Git resolution profile** MUST verify the mount against the parent commit's gitlink (`160000`) and `.gitmodules` path entry, and MUST verify the checked-out child commit matches the gitlink. The child's manifest identity MUST match the requested package. A Git URL is an untrusted retrieval hint; access to the parent does not grant access to a child remote. Git submodule dependency paths must be checked for traversal, symlink tricks, and unsafe URL schemes. This profile is **not yet implemented by the Python reference CLI**.

Git submodules MAY be nested; the release lock must include all transitive identities. A package containing multiple resources can be imported once and selected at resource granularity through placements; Git cannot natively fetch only one resource as an independent submodule.

## 6. Version conflicts

Multiple versions of the same package MAY coexist under different aliases. The published lock MUST unambiguously identify the release for each reference. An implementation MAY offer a shared-version resolution policy, but MUST report unsatisfiable constraints rather than silently choosing a semantically different package.

## 7. Adaptations and contribution flow

A teacher may reuse a resource unmodified, create an independent placement with instructional scaffolding, publish a derivative, or submit an upstream change. In v0.1 we recommend whole-resource replacement/extension with explicit provenance, not recursive opaque patches across vendor packages. Adapting safety-critical laboratory instructions requires separate review.

For a student contribution to a submodule, there are commonly **two independent reviews**: the owner accepts a change into the child package; the course lead updates the parent composition's pinned child commit. The upstream acceptance does not automatically update active course offerings.

## 8. Conformance / security

Test local imports, mismatched package identities, duplicate aliases, missing resources, submodule commit mismatches (Git profile), inaccessible remote repositories, nested dependencies, diamond imports, version conflicts, cyclic dependency graphs and preserved placements. Never execute imported scripts or instructions by default.

## 9. Open issues

Registry discovery, package selection from large monorepos, cryptographically authenticated mirrors, Git SHA-256 repositories, offline vendoring, and dependency override policies require additional specification and tests.
