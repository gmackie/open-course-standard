# Design decision log

| Decision | Current choice | Rationale / alternative |
| --- | --- | --- |
| Manifest discovery | `ocs.yaml` at each package root | Simple local parsing; independent of Git host |
| Serialization | Restricted YAML 1.2-like JSON-compatible subset | Human-editable with deterministic typed validation; exact profile remains draft |
| Package identity | `namespace/name` | Readable, independent of Git URL; verified namespace registry later |
| Resource identity | Stable package-scoped `id` | Survives file moves, remotes, placements and forks |
| Source vs package | Repository MAY contain many packages | Avoid district-monorepo mandates |
| Composition | Typed imports and placements | Git imports have different semantics than learning prerequisites |
| Submodules | Supported source transport, not mandatory | Whole-repository pinning with independent histories |
| Grade levels | Optional contextual metadata | Middle school through doctoral work uses the same core |
| Assessments | Reusable evidence blueprints; approved term releases | No permanent question bank required; AI is an optional candidate author |
| Student forks | Safe public fork or sanitized snapshot | Never leak protected Git history |
| LTI/QTI/CASE | Adapter profiles, not core dependencies | Use interoperable standards without forcing LMS runtime |
| OCS CLI language | Python reference alpha | Fast independent validator and tests; authoring language is not normative |
| Digests | Prototype file-inventory SHA-256 | Final canonicalization still under RFC-0004 discussion |

## Unresolved questions

1. Reuse a compatible Open Package Format (OPK) distribution envelope, or define OCS-native packaging?
2. Publisher namespace verification, canonical portable URIs and package mirrors?
3. Exact, interoperable release digest algorithm and signing policy?
4. How should monorepo root indexing and resource-level partial imports work?
5. Which source changes require republishing child vs parent resources?
6. Policy precedence for student-initiated disclosure and institutional exceptions?
7. Assessment evidence equivalence, bounded generation, human review and AI assistance limits?
8. How should Git and non-Git publisher contribution protocols interoperate?
