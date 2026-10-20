# OCS-0006: Assessment Blueprints, Evidence and Review

- **Status:** Draft
- **Version:** 0.1
- **Profile:** Assessment
- **Depends on:** OCS-0001, OCS-0002, OCS-0004, OCS-0005

The uppercase words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY use the meanings of BCP 14.

## 1. Assessment contract, not question bank

OCS defines what learners must **demonstrate**, what evidence counts, the conditions under which evidence is elicited, how it may be judged, and who may approve a decision. Multiple choice is one inexpensive interaction mode. An assessment can instead involve a lab, research proposal, oral defense, essay, simulation, performed task, code execution, or group project.

A reusable `AssessmentBlueprint` is *not* the same object as a generated exam or an attempt. The canonical lifecycle is:

`Blueprint -> Candidate -> Validation -> Human Approval -> Restricted Release -> Attempt -> Evidence -> Evaluation -> Final Decision`.

## 2. Blueprint fields

The experimental `assessment.schema.json` defines `id`, `metadata`, nonempty `evidence`, and `approval` as required. `goals`, `generation`, and `evaluation` are optional. The schema is a starting point; it does not attempt to encode every psychometric or evidentiary requirement.

```yaml
kind: AssessmentBlueprint
id: cell-division-exam
metadata: {title: Cell Division Assessment Blueprint}
goals: [biology.cell-division]
evidence:
  - id: explanation
    artifactType: document
    criterion: reasoning
  - id: transfer
    artifactType: structured-response
    criterion: unfamiliar-case
generation: {mode: per-term}
evaluation: {method: rubric-plus-teacher-review}
approval: {required: true, authority: course-lead}
```

## 3. Normative behavior (proposed)

- **OCS-ASM-001:** A blueprint MUST distinguish intended goals, required evidence, and the means of evaluating evidence.
- **OCS-ASM-002:** Evaluation MUST NOT claim to have assessed a criterion for which no appropriate evidence was gathered.
- **OCS-ASM-003:** Summative AI-generated assessment candidates MUST receive the course-authorized human approval required by their policy before release.
- **OCS-ASM-004:** An approved assessment release MUST pin the exact items/scenarios, scoring rules and evaluator versions or documented human evaluation authority.
- **OCS-ASM-005:** Changes to an approved release's assessed content or rules MUST invalidate the prior approval and require a new release or documented amendment.
- **OCS-ASM-006:** An agent MUST NOT self-assert course-lead approval or bypass required human confirmation.
- **OCS-ASM-007:** A learner-facing release MUST NOT include protected solutions or scoring secrets unless the authorized delivery model explicitly and safely requires them.
- **OCS-ASM-008:** Assessment attempts and grades MUST remain learner-scoped institutional records rather than being automatically published as curriculum assets.

A course lead MAY authorize controlled parametric variation or approved bounded adaptation, but this is not carte blanche for a live model to generate unreviewed high-stakes questions during delivery. Different generated exams are not automatically psychometrically equivalent; the program may need calibration or equating where stakes warrant it.

## 4. Evidence and evaluation

An `EvidenceRecord` SHOULD identify the exact assessment release, learner attempt (pseudonymized when appropriate), criterion, observable artifact, evaluator, decision, review state and provenance. Numeric scores are optional; provisional AI judgments MUST be distinguishable from confirmed institutional grades. There may be multiple assessors, peer reviewers, supervisors or committees. The responsible authority MAY reject a score while preserving the original evidence and review history.

Assistance and accommodations must be recorded only to the extent necessary and permitted by institutional policy. Storage and access rules must protect sensitive learner data.

## 5. Interoperability

[QTI 3](https://www.1edtech.org/standards/qti/index) is an optional exchange adapter for supported interaction/test types, not OCS's evidence ontology. [LTI Advantage](https://www.1edtech.org/standards/lti) is an optional delivery and gradebook interface: Deep Linking places an activity, core launch establishes platform context, NRPS can provide authorized membership, and AGS can exchange line items and scores. AGS is *not* a general submission/evidence transport. Exporters MUST report unsupported semantics instead of claiming a lossless conversion.

## 6. Security / tests

Test rubric references, evidence modality and criterion compatibility, protected key leakage, human approval bound to a release digest, unsafe model-generated items, rubric version changes and grade publication retries. No real student responses or unreleased exams belong in public fixtures.

## 7. Open issues

Evidence vocabulary/assurance levels, release attestation encoding, delivery state machines, rubric normalization, content generation reproducibility and LTI submission-review extensions need further design.
