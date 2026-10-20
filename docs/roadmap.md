# Roadmap (proposed)

## M0 - Portable, level-neutral foundations (this PR)

- Root `ocs.yaml`, typed resources, strict YAML/JSON Schema validation.
- Draft identity, composition, release, assessment, disclosure, workspaces and agent/LTI RFCs.
- Five cross-level/course-composition fixtures.
- Python `ocs validate|inspect|graph|lock|verify` **local-source prototype**, tests and CI.

## M1 - Git-native composition conformance

- Verify actual Git gitlinks, `.gitmodules`, SHA-1/SHA-256 object formats and nested submodules.
- Explicit workspace/monorepo roots, exact reference resolution, transitive lock/rebuild.
- Canonical package digests, file allowlists, security limits, archives, signatures and offline bundles.
- Reproducible `ocs pack`, `ocs diff`, `ocs resolve` and Github/GitLab/Artifacts export fixtures.

## M2 - Authoring and educational graph

- Typed Course, Codex, LearningExperience, Goal, Variant, DeliveryProfile, Program schemas.
- Curriculum semantic diffs, CASE/Schema.org alignment, translations, licensing/provenance.
- Reviewable teacher overlays and student contribution workflows, including sanitized forks.

## M3 - Assessment and runtime

- Evidence contracts, rubric schemas, bounded AI-generated term candidates, lead approval attestations.
- Protected exam releases, learner submissions, evaluation sessions and privacy-aware disclosure.
- LTI Advantage tool launch, Deep Linking, NRPS, AGS and interchange adapters for QTI/Common Cartridge.

## M4 - Agent APIs and federation

- Formal capability vocabulary, OpenAPI contracts, typed CLI/MCP binding, OAuth/Gatekeeper integration.
- Registry discovery, verified namespaces, signed publications, package mirrors and federation.
- Conformance profiles, interop test harness and independent reference implementation.

## Explicit acceptance gates

Every new MUST needs a testable target. Core fixtures must remain valid without calendar, school, credits, graded exams, Git remote, online registry or AI runtime. Security tests must demonstrate no protected-history export and no implicit execution of imported content. Declare unsupported runtime capabilities rather than faking success.
