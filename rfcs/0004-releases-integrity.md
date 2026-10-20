# OCS-0004: Releases, Dependency Locks and Integrity

- **Status:** Draft
- **Version:** 0.1
- **Profile:** Release
- **Depends on:** OCS-0001 through OCS-0003; [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) (potential canonical JSON profile)

The uppercase words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY use the meanings of BCP 14.

## 1. Three timelines

**Source history:** Git revisions of authoring content. **Curriculum release history:** publisher-approved immutable snapshots of compositions and dependencies. **Institutional offering history:** which release an actual class used and what content learners were authorized to access. A Git branch or mutable tag is not a release identity.

A published release is a resolved package root, exact dependency closure, content digest, and optional signed attestations. A *course offering* references a release but is not part of the portable public source tree.

## 2. Source versions versus release identities

Human-authored version ranges (`^2.3.0`) MAY be used for selection during authoring. A release MUST record exact resolved versions and bytes. A tag MAY provide a human-facing label, but it MUST NOT be the sole integrity reference. Submodule gitlinks record Git commits; OCS digests separately identify portable package contents across Git hosting changes.

- **OCS-REL-001:** Published locked compositions MUST record all required transitive package versions and immutable integrity references.
- **OCS-REL-002:** Lock resolution MUST be deterministic for a fixed set of authorized sources and policy inputs.
- **OCS-REL-003:** Resolvers MUST detect altered, absent, or mismatched locked content.
- **OCS-REL-004:** A release MUST NOT silently advance imports based on mutable upstream references.
- **OCS-REL-005:** Release metadata MUST distinguish the verified *content digest* from publisher *authorization or signature*.
- **OCS-REL-006:** Exam approval MUST bind to the exact approved candidate and evaluation rules; modification requires a new approval record.

## 3. A proposed lock shape

The experimental local reference CLI writes `.ocs/lock.json` with `lockVersion: 1`, a root `{id, version, digest}` and sorted dependency descriptors `{alias, id, version, digest, source}`. Prototype local package digests are computed from SHA-256 hashes and sizes of source files, sorted by package-relative path, then hashed as sorted-key compact UTF-8 JSON. The file `.ocs/lock.json` is excluded to prevent a hash cycle.

**This algorithm is provisional**, limited to filesystem-backed local sources. It does **not** define the final interoperable digest of a Git release. In particular, a stable specification must settle byte-level path normalization, symlinks, file modes, sparse source files, nested submodules, reproducible packed artifacts, and canonical JSON serialization. The draft schema is `src/ocs/schemas/v0.1/lock.schema.json`.

For final release conformance, a package manifest SHOULD enumerate the complete authorized file set, avoiding unintended inclusion of build output or confidential data. Signatures should be detached from the hashed content descriptor to avoid recursive hashing. [OCI descriptors](https://github.com/opencontainers/image-spec/blob/main/descriptor.md) and [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) provide implementation precedents.

## 4. Reproducibility is not perpetual availability

A complete lock can identify content no longer reachable on its original Git host. Institutions seeking archival guarantees SHOULD retain authorized local source snapshots, dependencies, and assets, with rights-aware retention. If a third-party publisher prohibits redistribution, an exported course may not include that dependency's bytes, and the archival report MUST indicate the gap. A content digest alone does not establish educational validity or legal permission to copy.

## 5. Publishing and approvals

A publisher SHOULD sign approved composition releases. An assessment release requires an explicit authorized course-lead approval of its exact generated contents, rubric, validation report, and scope; an AI tool's claim of approval is never sufficient. Conformance profiles may adopt DSSE/in-toto-style attestations or another documented signature mechanism, but none is mandated by the core parser.

## 6. Tests

Lock a local course, verify it, change a file, assert verification fails; change a dependency manifest version, assert lock mismatch; relocate an identical package, verify content digest stability under the defined profile; reject corrupted signatures in signing profiles; and detect missing archived blobs.

## 7. Open issues

Final canonical release hash, signing algorithm/agility, trust root distribution, package file allowlists, immutable archive format, and content-equivalence semantics across Git SHA-1/SHA-256 repositories are outstanding.
