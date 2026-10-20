# OCS-0005: Level-Neutral Education and Learning Experiences

- **Status:** Draft
- **Version:** 0.1
- **Profile:** Educational Semantics
- **Depends on:** OCS-0001 through OCS-0003

The uppercase words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY use the meanings of BCP 14.

## 1. Generality constraint

A sixth-grade history module, a secondary chemistry lab, a university seminar, a doctoral research course, a vocational practicum, and self-directed learning MUST all be representable without changing the OCS Core schema. Grade, learner age, credit, institution, course term, numerical grade, and conventional lesson/unit structure MUST NOT be baseline conformance requirements.

Educational **resource**, distributable **package**, semantic **composition**, audience-specific **variant**, delivery **profile**, real-world **offering** and learner **record** are distinct entities. One resource may appear in many courses, at very different levels. An ISCED code describes intended educational context, not intrinsic conceptual complexity or a credit award.

## 2. Model

- `LearningGoal`: knowledge, competency, inquiry, research, creative or professional-practice intent.
- `LearningExperience`: generic design referencing resources, interactions and possible outputs; `Lesson`, `Seminar`, `Laboratory`, `Fieldwork`, `Studio`, `Practicum`, and `Research` are experience types rather than mandatory file structures.
- `Course` / `Program` / `Pathway`: specialized compositions with prerequisites, optional ordering, and optional completion criteria.
- `CourseVariant`: explicit selections or replacements of educational resources (for instance, honors vs standard).
- `DeliveryProfile`: facilitated, self-directed, synchronous, asynchronous, accessible alternatives, suggested pace.
- `CourseOffering`: one institution's delivery, enrollment, gradebook bindings, academic calendar and recognition rules.

- **OCS-EDU-001:** Core package validators MUST NOT require an educational level or institutional metadata.
- **OCS-EDU-002:** A learning resource MAY be placed repeatedly, and MAY be reused across levels and institutions.
- **OCS-EDU-003:** Package imports MUST NOT be interpreted automatically as educational prerequisites.
- **OCS-EDU-004:** Experience authors MUST be able to express parallel, recurring, and optional activities without forcing a linear unit sequence.
- **OCS-EDU-005:** If a level code is present, the author MUST identify its classification scheme; consumers MUST NOT infer learners' eligibility solely from that code.
- **OCS-EDU-006:** Academic credit, official grades, completion and degree recognition MUST be attributed to the authorizing institution, not assumed from a package publisher's metadata.
- **OCS-EDU-007:** A learning goal MUST NOT necessarily imply a predetermined correct answer; genuine inquiry and original research are valid goals.

## 3. Cross-level example

A shared Watershed Codex can support:

- middle school: observing a stream and communicating simple graphs;
- secondary school: controlled investigations and measurement error;
- undergraduate: calibration, time series and reproducible analysis;
- graduate: methodological critique and experimental design;
- doctoral work: original claims, evidence and defense.

The Codex and dataset package retain their independent provenance; each composition selects different resources, experiences, and evidence criteria. A dataset produced by one class may become an input for another after appropriate review, privacy protection and data-quality metadata.

## 4. Competencies and knowledge representation

`teaches`, `assesses`, `reinforces`, `alignsWith`, and `requires` are typed *claims about educational intent*. They do not prove a student mastered material. Human learner competencies MUST be distinct from agent-execution skills (e.g. `SKILL.md`). Curriculum standards SHOULD link to established [CASE](https://www.1edtech.org/standards/case) identifiers where available; level metadata MAY map to [ISCED](https://uis.unesco.org/en/topic/international-standard-classification-education-isced). No government, district or institutional standard is required for an OCS core course.

## 5. Assessment neutrality

An experience MAY have no assessment, may assess formatively, or may produce artifacts judged by a human expert or committee. Fixed multiple-choice questions, grades and numeric scores MUST NOT be core requirements. Assessments and evidence are defined by RFC-0006.

## 6. Tests and open issues

Reference fixtures: elementary/secondary reading, laboratory science, undergraduate fieldwork, graduate discussion without exams, doctoral original research and a course without an institution. Outstanding: competency URI identity, sequencing operators, cross-level resource-adaptation assertions, accessibility profiles and degree-program constraint language.
