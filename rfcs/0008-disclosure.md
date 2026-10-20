# OCS-0008: Progressive Disclosure and Authorized Learner Views

- **Status:** Draft
- **Version:** 0.1
- **Profile:** Learning Runtime
- **Depends on:** OCS-0002 through OCS-0004, OCS-0007

The uppercase words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY use the meanings of BCP 14.

## 1. Separate clocks and authorities

Curriculum source versioning, course release scheduling, and learner-specific disclosure are distinct. A course may suggest a lesson sequence while each learner receives a different authorized subset based on schedule, completion, mastery, instructor approval, or a student-initiated request. Disclosure of content is **not** proof of mastery; viewing is not completion.

A published course MAY declare *recommended* release rules. Effective authorization is decided by the hosting institution's enforced policy. A `student-requested` rule can allow curious learners to access future explanations and supplemental materials while examinations, instructor keys, privileged rubrics, or legally restricted assets remain protected.

## 2. Proposed policy vocabulary

Resource selectors SHOULD use stable IDs/labels or typed attributes, not merely filesystem globs. Policies may express `scheduled`, `sequential`, `mastery`, `instructor-release`, `student-request`, `public`, or `restricted` as modes. A policy engine SHOULD report `allow`, `deny`, or `requires-approval` plus a policy reason and the granted resource scope.

When multiple rules apply, institutionally enforced legal/safety restrictions override course-author defaults. Instructor approval may grant access only within the authority delegated to that instructor. Student requests never override nondelegable protected-assessment rules.

## 3. Normative behavior

- **OCS-DISC-001:** Delivery runtimes MUST authorize each restricted resource read and not rely solely on tool discovery, UI hiding or possession of its ID.
- **OCS-DISC-002:** Restricted content MUST NOT be included in learner-accessible reachable Git history; a branch name, sparse checkout or student-facing tag is not a security mechanism.
- **OCS-DISC-003:** A student disclosure request MUST NOT expand authority beyond effective institution, offering and resource policies.
- **OCS-DISC-004:** Disclosure events MUST distinguish a request, decision, grant, and actual content access where those events are recorded.
- **OCS-DISC-005:** A disclosure grant MUST identify the exact authorized resource/release or a clearly bounded resource scope.
- **OCS-DISC-006:** Runtime operations MUST treat external course content, annotations, and agent instructions as untrusted input, not policy authority.

## 4. MCP / API request example

```json
{
  "operation": "ocs.disclosure.request",
  "resource": {"package": "org.example/watershed-codex", "resource": "hydrology.runoff", "version": "1.0.0"},
  "reason": "self-directed-study"
}
```

The response might be `allow` with narrowly scoped access, `deny` with a student-appropriate explanation, or `requires-approval`. A tool result is not a transferable, unlimited capability token. Protected content retrieval is separately authorized by the receiving server.

## 5. Privacy and retention

A school MAY track resource disclosure for course progression and educational support, subject to applicable law and institutional policy. It SHOULD minimize collection of private student prompts, retain a concise disclosure audit rather than full chats where possible, define retention/deletion rules, and separate operational logs from public Git. External AI providers must not automatically receive wider student records just because a delegated agent has MCP access.

Previously disclosed materials may be retained in student portfolios only where licensing and access policies permit. Revoking future access does not retroactively remove content the user already copied; systems MUST NOT promise retroactive confidentiality once bytes were delivered.

## 6. Tests and open questions

Tests: unauthorized direct resource read despite hidden MCP tool, future-lesson self-request, denied answer-key request, overlapping policies, access after offering closure, privacy-preserving audit, and sanitized Git export. Outstanding: formal policy language, durable grants, delegation/revocation, offline access, accessibility accommodations and federated district authority precedence.
