# Level-neutral examples

These are the five examples from the v0.1 "Open Course Standard" proposal
([PR #1](https://github.com/gmackie/open-course-standard/pull/1)), converted to OCS 1.1. They show
that one format serves learners from middle school to doctoral research. In the core format,
grade levels, terms, credits and exams are optional context, never requirements.

| Package | Level | What it shows |
| --- | --- | --- |
| `example.org/introduction-to-poetry` | any | The smallest useful course: one unit, a student note and a facilitator note. No subject, grade band, term or exam. |
| `example.org/biology-foundations` | secondary | OCS 1.1: an assessment that is a **portable activity** (`example.org/activities/…`, a writing task with a two-criterion rubric) and a teacher-only answer guide. It carries the v0.1 assessment blueprint's evidence (reasoning, transfer). |
| `example.edu/intro-hydrology-lab` | undergraduate | Fieldwork and reproducible analysis, with teacher-only safety and calibration notes. No grade band. |
| `example.edu/research-methods-seminar` | graduate | Inquiry and a research proposal reviewed by an examiner, with no quiz or letter grade. |
| `example.org/watershed-science` | any | A course **composed** from `example.org/watershed-codex` and another publisher's `example.edu/stream-lab`, with a rights cap, a reorder, a rename and a lockfile. |

## What changed from v0.1

- v0.1's YAML manifests and Markdown files became OCS 1.1 JSON packages. Lesson text lives in
  Codex notes, which are plain text with a visibility (`students` or `teacher-only`).
- v0.1's `composition.yaml` with Git-submodule-style imports became `modules` with version ranges
  and an `ocs.lock`. Nothing in the course depends on Git.
- v0.1's `AssessmentBlueprint` became an assessment-role activity pointing at a portable activity
  export with a rubric. The blueprint's approval workflow is deferred (see
  [docs/decisions.md](../../docs/decisions.md)).
- **Known gap.** The undergraduate and graduate examples use notes, not portable activities. In
  1.1, an activity export requires a K-12 `gradeBand`. A level-neutral context field is an open
  question for a future version (spec Appendix E).

All names, institutions and content are fictional. Readings are written for these examples or
are in the public domain. Licensed CC-BY-4.0.
