# Architecture rationale

OCS separates **resource identity**, **package distribution**, **source repository**, **educational placement**, **institutional offering** and **learner attempt**. Those are related entities but cannot be safely collapsed.

```text
Published resources / Codices / research objects
                     |
       Git repositories + OCS manifests
                     |
          Import and lock resolver
                     |
             Course composition
                     |
         Context + delivery profiles
                     |
          School / LMS course offering
                     |
       Authorized learner workspaces
                     |
        Evidence, evaluation, review
                     |
       Selected contributions upstream
```

## Three graphs

- **Structural:** package/version dependencies; baseline cycles are invalid, pin exact immutable releases.
- **Educational:** `teaches`, `assesses`, `requires`, `reinforces`, placements and ordering; cycles may be legitimate.
- **Provenance:** source, authors, derivation, review and publication; identity is separate from source location.

## Runtime boundaries

Git/Cloudflare Artifacts/GitHub/GitLab/Forgejo can host source, without defining pedagogy. R2 or another blob store may host large artifacts; registries resolve published packages. Institution-controlled applications own enrollment, disclosure grants, private evaluation, grades, and access policies. LTI is an interoperability adapter, not the educational data model. MCP and HTTP are policy-aware interfaces to the same capability contracts.

## Non-goals for Core 0.1

OCS Core does not define a gradebook, attendance system, accrediting body, universal psychometric scoring service, AI tutor, Git host, or e-learning UI. No government standards classification or academic credit system is mandated. No registry is required to parse an offline course.

## Privacy invariant

Students must not clone a Git object graph that includes unreleased assessments or instructor-only content. A learner workspace is either a safe fork of a public source or a fresh authorized snapshot. Private academic records are separate from public educational packages.
