# RFC 0002: Detached portable resource artifacts

- **Status:** Draft, for discussion (not normative OCS 1.1)
- **Date:** 2026-11-14
- **Scope:** Copying teacher-authorized presentation slides, PDFs, images and media across institutions
- **Reference prototype:** packages/ocs/src/experiments/portable-resource.ts

## Problem

A professor can reuse OCS 1.1 modules and portable activity exports, but a resource
reference under resources/<id>.json identifies a district-local released resource.
A recipient at another institution cannot necessarily retrieve the original PDF,
PowerPoint, image, audio or video. The current package layout intentionally admits
strict JSON data only and must not be weakened by inserting arbitrary media bytes.

## Detached manifest proposal (0.1)

The experimental PortableResourceManifestV0 schema requires:
- profile ocs-portable-resource/0.1;
- publisher-scoped id, immutable version, SHA-256 digest and byteLength (1 to 100 MiB);
- an allowlisted mediaType: PDF, PPTX, DOCX, JPEG, PNG, text/plain, MP3, MP4;
- title, attribution, a claimed license {identifier, optional HTTPS uri};
- visibility public or restricted;
- optional HTTPS locator, alternative text, and transcriptResourceId.

The bytes are **never** embedded in ocs.json, ocs.lock, an OCS package,
an activity export, or a collaboration proposal. A downloadable asset can be
delivered as separately authenticated content-addressed bytes, mirrored under
a permitted license or via an institution's authorized channel.

The prototype verifies exact byte length and SHA-256 only, with no fetch or
execution. It intentionally cannot establish a file's true media type, safety,
authorship, licensing rights, accessibility or publisher identity.

## Required destination import sequence (future consumer)

1. Verify the resource publication signature against a district-approved publisher
   key, distinct from transport TLS. Define the signature context in a future RFC.
2. Check the license, declared use, institutional publication policy and recipient
   authorization. A license claim in a manifest is never itself a rights grant.
3. Obtain bytes only through a destination-controlled, SSRF-resistant and
   authorization-scoped fetch or authenticated upload. Never dereference links
   merely because they appear in a manifest or prompt.
4. Enforce maximum download and decompression sizes, redirects, content type
   verification, malware/document scanning and safe isolation of complex formats.
5. Match byte length and digest; reject substitutions.
6. Confirm alternate text/captions/transcripts or trigger accessibility review.
7. Produce a **local** immutable resource release through the destination's own
   Content Studio and approval workflow. No central publisher may force-install it.

The manifest's visibility field is a publication assertion, not access control.
A resource listed as restricted needs actual access controls at the hosting source
and any mirror. Public immutable blobs cannot be remotely made secret.

## Avoid duplicating Common Cartridge

1EdTech Common Cartridge is an established interchange format for packaged
educational files, media, assessment objects and related metadata:
https://www.1edtech.org/standards/cc .
Its 1.4 work also includes rich K-12 and accessibility metadata, CASE links
and QTI assets. The detached OCS proposal should **not** replace CC file
packaging. Prefer using CC/Thin CC or a compatible archive to transport actual
assets when they express the intended rights and placement semantics.
The additional OCS responsibility is an immutable publisher-scoped reference,
content digest, verified provenance, local review and a standard way to
associate assets with a course version. A CC adapter must disclose any
semantics it cannot preserve rather than silently dropping them.

## Relationship to OCS 1.1

This is deliberately *not* a new accepted form of OCS resource reference.
Adding {portable:{id,version,digest}} to OCS resources would require a new format
version, schemas, conformance cases, bundle transport design, and installation
rules. Existing OCS 1.1 consumers must continue refusing unknown keys and paths.
The detached prototype establishes useful contracts without changing those rules.

Portable activity exports remain JSON-only and do not gain external code execution.
An OCS course referencing Gadget Blueprints must continue to point to an approved
release; code never travels inside these resource manifests.

## Initial tests and acceptance

Prototype tests verify exact-byte integrity, tamper detection, HTTPS-only locators
and rejection of active HTML media or unknown fields. They do not certify a
real-document import pipeline.

Before Candidate: signed manifest and content-addressing fixtures; URL
policy/redirect threat tests; licensing and attribution metadata proposal;
sandboxed PDF/PPTX/DOCX import; rights-narrowing tests; installer acceptance.
Before Accepted: two independent institutions exchange at least one legally
shareable PPTX and PDF with accessible alternatives, maintain local copies,
and show no student-data or executable-content escape.

## Decisions needed

- Format/version for a resource release reference: OCS 1.2 or a separate profile?
- Full bundle packaging versus mirrors and offline distribution.
- Rights vocabulary and Creative Commons/SPDX mapping; how to express
  restricted teaching material without implied public reuse.
- Media-type policies and maximum size per deployment.
- Signed issuer attestations for accessibility and rights review, without
  treating a self-asserted claim as certification.
