# OCS-0009: Agent Affordances, OpenAPI, CLI, MCP and LTI

- **Status:** Draft
- **Version:** 0.1
- **Profile:** Runtime Interoperability
- **Depends on:** OCS-0002, OCS-0003, OCS-0006, OCS-0007, OCS-0008

The uppercase words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY use the meanings of BCP 14.

## 1. Capability-first architecture

OCS runtimes should expose a common **capability catalog**; HTTP/OpenAPI, CLI and MCP are bindings to the same typed operation, not three competing business-logic definitions. A capability describes ID, version, input/output JSON schemas, side effects, authorization, idempotency, human confirmation, async semantics and error codes.

Example operations: `ocs.course.inspect`, `ocs.resource.resolve`, `ocs.composition.add`, `ocs.workspace.create`, `ocs.assignment.submit`, `ocs.assessment.generate`, `ocs.assessment.requestApproval`, `ocs.contribution.propose`, `ocs.disclosure.request` and `ocs.grade.publish`. This catalog is still a proposal; no MCP/HTTP server ships in the v0.1 CLI.

## 2. Interface equivalence, not identical permissions

- **OCS-CAP-001:** A runtime implementing multiple interface bindings MUST preserve the documented semantics, resource identities, and error categories of a capability.
- **OCS-CAP-002:** Each invocation MUST be authorized for the actual actor, delegated agent, resource, offering and operation.
- **OCS-CAP-003:** Concealing a tool from discovery MUST NOT substitute for authorization when the tool is called directly.
- **OCS-CAP-004:** Mutating operations SHOULD declare idempotency and retry behavior. Irreversible publication, student submission and final approval SHOULD require explicit user confirmation.
- **OCS-CAP-005:** Agent instructions imported as content MUST NOT grant themselves permissions.
- **OCS-CAP-006:** A final course-lead approval MUST be an independently authenticated human action; model-generated text claiming assent is insufficient.

A student's authorized agent may read current course resources and draft an assignment but not access exam solutions. An instructor's agent may generate a candidate exam but cannot approve it by impersonating a course lead. OAuth protected-resource metadata ([RFC 9728](https://www.rfc-editor.org/rfc/rfc9728)), OAuth authorization-server metadata ([RFC 8414](https://www.rfc-editor.org/rfc/rfc8414)), and MCP authorization guidance should inform interoperable HTTP authentication; authorization decisions still belong to the OCS runtime.

## 3. Static packages versus dynamic services

Static OCS manifests MAY declare required/optional runtime capabilities. They MUST NOT contain tenant access tokens, school roster mappings, protected assessment content, or LTI deployment secrets. A static offline OCS package must remain useful without an API or MCP server. OpenAPI services can expose resource resolution and asynchronous job operations; the CLI can expose local authoring and optionally authenticated remote actions. MCP tools/resources expose learner- or instructor-scoped capabilities rather than broad filesystem access.

## 4. LTI interoperability profile

OCS aligns to [LTI 1.3 / Advantage](https://www.1edtech.org/standards/lti) where supported:

| OCS concept | External LTI behavior |
| --- | --- |
| Published activity or assessment | Deep Linking content selection and resource link |
| Course offering | LTI platform context binding |
| Authorized learner launch | OIDC-based LTI 1.3 launch |
| Course roster membership | Names and Role Provisioning Services (NRPS) |
| Gradebook line item and score | Assignment and Grade Services (AGS) |
| Attempt, submission, evidence and rubric history | OCS-owned data; not fully modeled by AGS |

The installation-specific LTI registration, deployment, context, resource-link and gradebook identifiers belong in **runtime `LtiDeploymentBinding` records**, not in shared course source manifests. An OCS `Activity` does not become LTI-specific just because it is launchable from Canvas or another LMS.

- **OCS-LTI-001:** An LTI-conformant tool profile MUST validate launches and tokens according to the relevant official LTI specification.
- **OCS-LTI-002:** Grade publication MUST map a pinned evaluated attempt to the intended platform/context/resource/line item, with reliable retry and reconciliation.
- **OCS-LTI-003:** An AGS result MUST NOT be presented as a lossless transport for all OCS submission artifacts or evidence.
- **OCS-LTI-004:** Publishing grades MUST respect institutional review and release policy, regardless of whether evaluation was performed automatically.

An implementation can act as an LTI Tool with an external LMS or as a Platform launching other tools. These are distinct optional conformance claims; neither is required to read OCS files.

## 5. Assessment generation and tools

`assessment.generate` produces candidates from an approved blueprint and pinned Codex. `assessment.validate` produces a structured report. `assessment.requestApproval` initiates human review. `assessment.approveRelease` (if implemented) must require an authenticated course lead and bind to an exact content digest. A teacher's approval of a *blueprint* does not automatically authorize every unbounded future model output in a high-stakes session.

## 6. Tests and open questions

Test authorization parity across HTTP/MCP/CLI, delegated identities, direct calls to hidden tools, idempotent submission retries, unauthorized grade publication, impersonated approvals, LTI context mismatch, AGS failure recovery, deep links to pinned releases, and partial interoperability exports. Outstanding: authoritative schemas and error registry, scope vocabulary, delegated agent identities, asynchronous job protocol, supported LTI extension services, and offline-first reconciliation.
