# OCS RFC Index

**All RFCs are Drafts** for the experimental `0.1` proposal. No RFC is currently Stable. The uppercase requirement words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY have the meanings in [BCP 14](https://www.rfc-editor.org/info/bcp14) only when capitalized.

| RFC | Title | Status | Profile |
| --- | --- | --- | --- |
| [0001](0001-core-repository.md) | Core Repository and Manifest Format | Draft | Core |
| [0002](0002-resource-identity.md) | Resource Identity and References | Draft | Core |
| [0003](0003-composition-git.md) | Composition, Packages and Git Submodules | Draft | Composition |
| [0004](0004-releases-integrity.md) | Releases, Lockfiles and Integrity | Draft | Release |
| [0005](0005-educational-context.md) | Educational Context and Learning Experiences | Draft | Education |
| [0006](0006-assessment-evidence.md) | Assessment Blueprints and Evidence | Draft | Assessment |
| [0007](0007-workspaces-contributions.md) | Learner Workspaces and Contributions | Draft | Collaboration |
| [0008](0008-disclosure.md) | Progressive Disclosure and Access Control | Draft | Runtime |
| [0009](0009-capabilities-mcp-lti.md) | Capability APIs, MCP and LTI | Draft | Runtime / Integration |

## Conformance design

Only RFC-0001 and RFC-0002 establish the proposed baseline file format. Specialized profiles MUST NOT retrospectively impose grade levels, institutional affiliations, AI services, Git hosting, academic credit, or LMS requirements on a minimal core package. A static file package MAY be fully valid even if it has no runtime at all.

The Python CLI currently exercises **local** portions of RFC-0001/0002/0003/0004; it is not an implementation of remote Git, signatures, licensing decisions, protected assessment delivery, LTI or MCP. Tests and schema locations are described in the main README. Requirements have stable candidate IDs, but the draft spec can still change them.

## External interoperability foundations

OCS intentionally treats [Git](https://git-scm.com/docs/gitsubmodules), [JSON Schema 2020-12](https://json-schema.org/draft/2020-12), [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785), [CASE](https://www.1edtech.org/standards/case), [LTI](https://www.1edtech.org/standards/lti), [QTI](https://www.1edtech.org/standards/qti/index), [Common Cartridge](https://www.1edtech.org/standards/cc), [SPDX](https://spdx.dev/), and [W3C PROV](https://www.w3.org/TR/prov-o/) as independent standards rather than claiming they are part of the OCS baseline.
