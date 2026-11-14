# RFC 0001: Detached curriculum contribution and provenance profile

- **Status:** Draft, for discussion (not normative OCS 1.1)
- **Date:** 2026-11-14
- **Scope:** Cross-institution course corrections and contribution review
- **Reference prototype:** packages/ocs/src/experiments/contribution.ts

## Problem

A professor reuses another professor's module, corrects an explanation, and wants to
offer the correction to its publisher. OCS 1.1 already composes immutable signed
packages and records the origin of a composed unit, but has no interoperable record
for a proposed change or how one published course derives from another.

A contribution is not an OCS package and is not authority to publish one.

## Proposed opt-in wire record (0.1)

The experimental ContributionProposalV0 validator implements this strict JSON shape:

- profile: literal ocs-collaboration/0.1.
- id: opaque proposal ID, unique in the receiving review service.
- source and candidate: each exactly {id, version, digest}, referencing valid immutable
  OCS packages. A candidate may use another publisher ID.
- purpose: correction, accessibility, localization, enrichment, or other.
- summary: bounded plain text (OCS active-content restrictions).
- changedPaths: exhaustive, unique, fixed-layout OCS JSON file paths. The generated
  ocs.lock is deliberately excluded. Include ocs.json when changed.

The prototype verifies that both supplied packages match their pinned identity,
version and SHA-256 digest; that paths describe all changed files; and that at
least one non-manifest file substantively changed. JSON formatting changes are
not substantive. It does not check publisher signatures, rights, or permissions:
the receiving service MUST make those checks separately before accepting or publishing.
The proposal ID is not a capability or identity token.

Proposals reference the candidate's **complete immutable package**; they do not
carry scripts, arbitrary file paths, student data, or a patch to be executed. They
must never be inserted into an OCS 1.1 package, whose layout is closed.

## Review state and derivation

A future review service maintains a separate append-only event log:

proposed -> under-review -> changes-requested | rejected | accepted.

Every event must bind the proposal digest, actor, role, policy decision, and timestamp.
The reviewer must be authorized by the target publisher or institution. A proposal's
claimed authorship is NOT proof of authority. Accepted means the maintainer reviewed
the idea; only a new immutable publisher-signed OCS package establishes a release.

The longer-term provenance graph should distinguish:
1. publisher authenticity (OCS signatures, existing);
2. source composition provenance (OCS composer, existing);
3. derivation and creative attribution (new external records, PROV-compatible);
4. rights/license and review decisions (external records with independently verified claims).

Never infer that a course's publisher is the original human author. Preserve the
source attribution chain and links to third-party licenses. An institution may
reject a suggestion while the contributor keeps a lawfully licensed local edition.

## Security, privacy, and trust

- Validate OCS packages, digests and publisher signatures before creating a review.
- No public learner records, student submissions, grades, private chats, credentials,
  unreleased test banks, or assessment answer keys in proposals, candidate packages,
  comments, logs, previews, or public notification payloads.
- OCS Codex notes with teacher-only visibility are NOT confidential when exported in
  a publicly downloadable bundle. Restricted material needs an access-controlled
  distribution channel, not a UI-only visibility flag.
- Check copyright ownership, license compatibility, institutional author authority
  and any third-party media rights before redistributing.
- A published immutable version cannot be fully recalled from mirrors; use
  publishing approvals and a prepublication privacy review.
- A reviewer cannot sign for the original publisher unless separately authorized.

## Standards and ecosystem reuse

Creative provenance should map to W3C PROV-O (prov:wasRevisionOf,
prov:wasAttributedTo, qualified derivation) rather than adding a second
unrelated concept of authorship: https://www.w3.org/TR/prov-o/ .
For interactive content, H5P's OER Hub already supports reuse and automatic
attribution: https://h5p.org/h5p-oer-hub-jan-2026 .
This profile must complement such tools by enabling independently maintained
course packages to offer *reviewed improvements back to upstream publishers*,
not by claiming that sharing/remixing/attribution is itself novel.

## Compatibility

OCS 1.1 package, digest, signature, resolver and lockfile bytes are unchanged.
All collaboration records are **detached**; OCS consumers may ignore them.
Git and any social account are optional implementation details.
An institution must retain a path to local-only publication and consumption.

## Initial tests, conformance and decision gates

The prototype unit tests exercise pinned refs, exhaustive changes, invalid paths,
and version-only changes. These are NOT yet a cross-implementation conformance suite.
Before Candidate status: add stable JSON Schemas, test vectors and a runner, plus
external identity/signature verification and rights attestation handling.
Before Accepted: interoperate two independently operated publishers and one
non-EducateOS consumer; test revocation, rejected proposals, attribution,
role loss and legal takedown workflows without breaking existing course copies.

## Decisions needed

1. Which identity mechanisms may attest educator and publisher authorization?
2. Should institutional moderation decisions be signed and independently verifiable?
3. How do we represent content-level derivation and attribution using W3C PROV?
4. Can restricted proposals exist without entering an open discovery index?
5. How do contribution IDs remain globally unique without a required central registry?
