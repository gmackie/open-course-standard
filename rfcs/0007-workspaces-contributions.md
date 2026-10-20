# OCS-0007: Learner Workspaces, Forks and Curriculum Contributions

- **Status:** Draft
- **Version:** 0.1
- **Profile:** Collaboration Runtime
- **Depends on:** OCS-0002, OCS-0003, OCS-0004, OCS-0008

The uppercase words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY use the meanings of BCP 14.

## 1. A learner's work is not the course itself

A course source package, an approved release, a learner workspace, an assessed submission, a proposed contribution, and a published derivative are different objects. Student essays, research notes, field datasets, code, peer comments and projects can live in versioned working repositories. Teacher review may selectively elevate authorized artifacts into reusable curriculum packages.

An ordinary Git fork is appropriate **only** if the student may read the full reachable source history. For courses containing protected assessment material, generate a separately initialized repository from a sanitized learner-authorized snapshot: Git branches and sparse checkout cannot erase private objects already in a clone.

## 2. Normative behavior

- **OCS-WORK-001:** Learner-created work MUST remain private or appropriately class-scoped until an authorized publication action occurs.
- **OCS-WORK-002:** Access to a learner workspace MUST be independent of visibility of the canonical course repository.
- **OCS-WORK-003:** A restricted course MUST NOT be forked or cloned into a learner environment if its reachable history includes materials the learner is not authorized to access.
- **OCS-WORK-004:** A contribution MUST identify the target resource/release and the proposed changes, preserving attribution and licensing as applicable.
- **OCS-WORK-005:** Accepting a contribution to a dependency MUST NOT automatically change an active course offering's pinned version.
- **OCS-WORK-006:** An assignment grade MUST NOT depend on whether an external package maintainer merges the student's contribution.
- **OCS-WORK-007:** Published student works MUST NOT inadvertently include private grades, sensitive metadata, protected assessments or other learners' personal data.

## 3. Contribution types

Contributions may correct an explanation, improve accessibility, translate a lesson, add a worked example, publish a reviewed dataset, introduce an alternative argument, or propose a revised lab. They can be reviewed through Git pull requests, but providers MAY use other review systems if the contribution's target revision, diff, authorizing reviewer, and final disposition remain portable.

A review should distinguish pedagogical validity, factual correctness, student consent, intellectual property rights, and technical safety. Minors' attribution/publication requires jurisdiction- and institution-appropriate permissions, and should support pseudonymous or nonpublic attribution where appropriate.

## 4. Submodule contribution workflow

A student changes a chemistry lab in its child repository and proposes the change upstream. The lab publisher reviews and releases a new immutable revision. Separately, the parent course's lead reviews the *submodule pointer update* and decides whether the change belongs in the next course release. These are separate authority boundaries.

## 5. Research and long-running projects

A fieldwork project may span cohorts. Prior students' reviewed datasets can become inputs for statistics courses; an undergraduate's analysis can become a graduate seminar's source. Published research artifacts SHOULD include methods, calibration/measurement limitations, provenance, licensing and quality annotations. Reuse does not imply research-grade validity.

## 6. Tests / open questions

Tests should cover ordinary safe forks vs sanitized snapshots, export of learner-owned authorized artifacts, accidental personal-data publication, downstream update without consent, and competing contributions. Still open: group authorship, consent revocation, portfolio persistence, copyright allocation and content-level semantic merge conflicts.
