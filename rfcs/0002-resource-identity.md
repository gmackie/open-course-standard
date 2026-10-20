# OCS-0002: Resource Identity, References and Provenance

- **Status:** Draft
- **Version:** 0.1
- **Profile:** Core Resource
- **Depends on:** OCS-0001, OCS-0004 (locked releases)

The uppercase words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY use the meanings of BCP 14.

## 1. Identity layers

OCS distinguishes **logical resource ID**, **package ID**, **published package version**, **immutable release digest**, **placement ID** and **course offering ID**. Git repository URLs and filesystem paths are *locations*, not identities. IDs do not alone prove who owns the corresponding names.

In v0.1, package IDs follow `namespace/name`, e.g. `org.example/watershed-codex`. The namespace is a lower-case dotted label; the package name is lower-case with periods, hyphens or underscores. Resource IDs are package-scoped, such as `hydrology.runoff`, and may contain letters, digits, dots, hyphens and underscores. Versions use SemVer syntax. The schemas define the exact accepted grammar.

- **OCS-ID-001:** Every independently addressable resource MUST have a stable ID unique within its package release.
- **OCS-ID-002:** Publishers MUST NOT reassign a previously published ID to an unrelated work.
- **OCS-ID-003:** Resource identity MUST NOT depend on a filename, filesystem directory, Git remote, institution or instructional placement.
- **OCS-ID-004:** Two placements of the same resource MAY have different pacing, purpose, context, and access policies without creating new logical source resources.
- **OCS-ID-005:** A resource reference MUST distinguish the publishing package from the package-scoped resource identifier.

## 2. References

Prefer structured references to an unregistered URI scheme:

```yaml
package: org.example/watershed-codex
resource: hydrology.runoff
version: "2.3.0"
```

In a composition, a short reference may use an import alias plus resource ID:

```yaml
use:
  from: codex
  resource: hydrology.runoff
```

An authoring reference MAY select a compatible release range. A published locked reference MUST resolve to a specific release and verified digest. Unknown resources MUST NOT be silently replaced by similarly titled content.

## 3. Publisher identity and trust

Namespacing is not identity verification. A registry MAY verify namespace ownership using DNS control or authenticated registry accounts. A public publisher claiming `org.example` has not proved it controls that domain merely by writing the name into `ocs.yaml`.

Separate four claims: self-declared name, verified publishing namespace, cryptographically signed release, and content equality by digest. No one claim automatically entails the others. Registry metadata and signatures MUST NOT be silently forged for imported content.

## 4. Forks, revisions and derivatives

A student or teacher MAY fork the source repo and propose changes under the existing logical resource ID, but that fork is not automatically an authoritative upstream release. An independently published derivative MUST have its own package identity and SHOULD record `derivedFrom`, the exact source release, copyright/license obligations, and change rationale. An accepted upstream contribution can become a new release of the original resource ID.

`derivedFrom` describes provenance; `requires` describes learning prerequisites; and `imports` describes structural dependencies. Consumers MUST NOT interpret them as the same edge type. This can be mapped to W3C PROV in an interoperability profile.

## 5. Reference validity

A consumer SHOULD surface deleted, withdrawn, moved or unavailable resources as structured errors. A registry MAY maintain verified redirects from older IDs, but a resolver MUST preserve the original identity and provenance record rather than pretending a redirect is the same release.

## 6. Security / tests

Test package moves between Git remotes, two independent publishers claiming the same unverified name, resource filename moves without ID changes, conflicting IDs within a package, fork versus signed upstream release, and references to inaccessible protected material. A digest proves exact bytes under a defined algorithm; it does not prove educational correctness or authorization.

## 7. Open issues

Canonical URI/PURL representation, namespace registration, publication authority rotation and the rule for when educational edits warrant a new logical resource identity require separate decisions.
