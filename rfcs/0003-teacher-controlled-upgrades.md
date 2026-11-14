# RFC 0003: Teacher-controlled course update planning

- **Status:** Draft, for discussion (not normative OCS 1.1)
- **Date:** 2026-11-14
- **Scope:** Preserve local adaptations when a contributing publisher releases updates
- **Reference prototype:** packages/ocs/src/experiments/revision-plan.ts

## Problem

OCS 1.1 locks exact package versions and digests and provides module composition
with hide, rename and reorder overrides. EducateOS can currently install a
published course but its course-library implementation does not yet upgrade a
class in place; a newer version is treated as a separate install. Two educators
can edit the same lesson independently without an update proposal that accounts
for both. An active class must never silently switch content.

## Proposed three-way preview

Inputs are three independently valid OCS package snapshots:
- BASE: immutable course version from which an educator started;
- LOCAL: the educator's authorized local adaptation;
- UPSTREAM: newer version from BASE's original publisher.

The experiment validates all packages with the OCS 1.1 reader and ensures the
source publisher/package ID is unchanged between BASE and UPSTREAM.
It ignores generated ocs.lock and compares canonical parsed JSON on fixed
OCS document paths, classifying each path:

| Condition | Preview result |
| --- | --- |
| Neither changed | unchanged |
| Only upstream changed | offer-upstream |
| Only local changed | keep-local |
| Both produced identical content | same-change |
| Both changed differently | needs-review |

The planner is intentionally conservative at **file** granularity. It will flag
ocs.json if both authors changed a manifest; it does not claim a safe semantic
merge and never applies a selected change. This matters when teachers adjust
instructional meaning, standards, rubrics or answer-key visibility. All Codex
entries are marked sensitive for review.

Future structured update planning may compare stable unit/item identities and
propose field-level merges, but MUST treat renamed or removed IDs, incompatible
standards, change of learning purpose, rights widening, and assessment security
as explicit review cases. AI may summarize but may not authorize a merge.

## Runtime adoption invariants

- No student-facing content changes without an authorized teacher's explicit
  approval. Admin/district policy can require further review.
- Active submissions remain tied to the exact published version and digest
  they used; grading and audit history remain unchanged.
- Any proposed update must re-run OCS resolver/composer, enforce override
  targets, check all resource rights, and use local curriculum/policy validation.
- Conflict resolution creates a new local publication or drafts rather than
  mutating signed immutable package bytes.
- Local adaptations must survive upstream changes or be reported as conflicts.
- The destination may decline a publisher's update indefinitely.
- Existing course/library install records and LMS placements must not be
  overwritten by title-matching heuristics.

## Why this is outside core OCS

The OCS 1.1 source format already specifies deterministic resolution. Updating
a live class is a runtime action owned by the institution. No changes to
OCS package semantics, lockfile bytes or signature contexts are proposed.
The prototype is an optional UI planning primitive, not a new normative
composer class.

## Initial tests and acceptance

Prototype tests exercise upstream-only updates, conflicting local changes,
canonical JSON equality and invalid-package rejection. Tests do not simulate a
deployed teacher UI or a full installer migration.

Before Candidate: distinguish base and candidate identities explicitly and
add independent input fixtures; construct an atomic, policy-approved install
migration with rollback and staged deployment; exercise title collisions,
deleted items, answered assessments and revoked publishing rights.
Before Accepted: teachers in two separate districts review, accept or decline
real updates with audit trail; the same student submission and grade remain
pinned before and after the update.

## Decisions needed

- Should course installers keep a source-to-local immutable mapping for every item,
  not merely an installed module's title and original package version?
- When do old assignments keep using an older version versus get a new instance?
- How are active term policies and accessibility reviews applied to proposed updates?
- Which changes require both teacher and curriculum-administrator approval?
