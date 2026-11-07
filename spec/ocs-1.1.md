# Open Course Standard (OCS) 1.1

- **Version:** 1.1 (format versions `"1.0"` and `"1.1"`)
- **Status:** Published draft standard. It is not the product of a standards body; see
  [GOVERNANCE.md](../GOVERNANCE.md).
- **Editor:** Graham Mackie
- **License:** this document is licensed under
  [CC-BY-4.0](../LICENSES/CC-BY-4.0.txt).
- **History:** OCS 1.0 (2026-10-20) and OCS 1.1 (2026-11-04) were first published as the
  EducateOS "Open Course Specification" (RFC 0001 in the EducateOS repository). This document
  is that specification made vendor-neutral. It defines the same format: every package,
  lockfile, export, signature and bundle that was valid under the EducateOS text is valid
  under this one, and the reverse. See [Appendix C](#appendix-c-history-and-name).

## Abstract

OCS is a format for courses that teachers build from reusable parts. A course **package**
holds a manifest, units, references to activities and resources, and notes for teachers and
students. A package can include other packages as **modules**, and can hide, reorder and rename
what it includes without copying it. A **lockfile** records the exact version and content
digest of every module, so the same course always composes to the same outline. Packages are
data only, identified by content digests, optionally signed by their publishers, and can be
distributed as one **bundle** document.

## Contents

1. [Conventions and terminology](#1-conventions-and-terminology)
2. [Goals and non-goals](#2-goals-and-non-goals)
3. [JSON, text and digests](#3-json-text-and-digests)
4. [Identifiers and versions](#4-identifiers-and-versions)
5. [Package layout](#5-package-layout)
6. [The manifest](#6-the-manifest-ocsjson)
7. [Package entries](#7-package-entries)
8. [Format versions](#8-format-versions)
9. [The package digest](#9-the-package-digest)
10. [Resolution](#10-resolution)
11. [The lockfile](#11-the-lockfile-ocslock)
12. [Composition](#12-composition)
13. [Rights propagation](#13-rights-propagation)
14. [Portable activities and activity exports](#14-portable-activities-and-activity-exports)
15. [Publication signatures](#15-publication-signatures)
16. [Bundles](#16-bundles)
17. [Installation](#17-installation)
18. [Security considerations](#18-security-considerations)
19. [Privacy considerations](#19-privacy-considerations)
20. [Relation to other formats](#20-relation-to-other-formats)
21. [Conformance](#21-conformance)
- [Appendix A. Implementations (non-normative)](#appendix-a-implementations-non-normative)
- [Appendix B. Problem kinds](#appendix-b-problem-kinds)
- [Appendix C. History and name](#appendix-c-history-and-name)
- [Appendix D. Changes from 1.0 to 1.1](#appendix-d-changes-from-10-to-11)
- [Appendix E. Open questions](#appendix-e-open-questions)

## 1. Conventions and terminology

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**,
**SHOULD NOT**, **RECOMMENDED**, **NOT RECOMMENDED**, **MAY** and **OPTIONAL** in this document
are to be interpreted as described in BCP 14 ([RFC 2119], [RFC 8174]) when, and only when, they
appear in all capitals, as shown here.

The JSON Schemas in `schemas/1.1/` (in this repository) are normative for the structure of every
document this specification defines. Where this text states a rule a schema cannot express
(for example, that a unit item names an existing entry), the rule is normative in addition to
the schema. If the text and a schema disagree, the text is authoritative and the disagreement is
an erratum.

Sections, notes and appendices marked non-normative, and all examples, are informative.

**Package.** An immutable set of JSON files at fixed paths (Section 5), identified by a package
ID and a version.

**Course.** A package that is being composed or installed. Any package can be a course, and any
package can be a module of another.

**Module.** A package that another package includes, through an entry in its manifest's
`modules` list.

**Publisher.** Whoever publishes a package or an activity export, identified by the DNS-style
domain at the start of its IDs.

**Package store.** Anything that holds published package versions and activity exports: a
directory, a database, a registry, an object store or a Git repository. This specification does
not define a store. It defines the operations a resolver needs (Section 10.1).

**Destination.** An organization (for example a school, district, university or training
provider) that installs a course into its own systems.

**Producer.** Software that writes OCS documents. **Consumer.** Software that reads and checks
them. **Composer.** Software that resolves a course's modules, writes its lockfile and composes
its outline. Section 21 defines the conformance requirements of each.

## 2. Goals and non-goals

### 2.1 Goals

1. **Modular composition.** A course can include other courses' units without copying them, and
   can hide, reorder and rename what it includes.
2. **Determinism.** The same manifest, published packages and lockfile always give
   byte-identical lockfiles and identical composed outlines.
3. **Integrity.** Every included package is identified by its ID, version and content digest.
   Content that changes after publication is refused.
4. **Rights that only narrow.** Including a module can restrict how its resources are used,
   never widen it.
5. **Data only.** A package contains no executable code, so composing or importing one can
   never run anything.
6. **No version control for teachers.** Version control is an implementation choice of a
   package store. The format, and every message a conforming tool produces about it, can be
   expressed in course words: module, version, publish, update.
7. **Its own contract.** OCS maps to Thin Common Cartridge, Common Cartridge and CASE through
   adapters, and says where those formats cannot carry its meaning.
8. **Level-neutral core.** A package needs no grade level, term, credit system or
   institution. Educational context fields are optional (but see Appendix E, question 6).

### 2.2 Non-goals

- **Activity content inside packages.** An activity reference names an activity definition. The
  definition (steps, evidence plan, rubric) lives in the destination's systems or, since 1.1, in
  a separately published activity export (Section 14).
- **Student data.** A package never holds rosters, submissions, grades or student work.
- **Rights certification.** OCS records the use a package makes of a resource release. Whether
  that release permits the use is decided by the destination when it installs the course.
- **A central registry.** Packages come from package stores the destination chooses. No
  registry is required, and no publisher's service is ever in a destination's student data
  path.
- **Backtracking dependency solving.** See Section 10.4.
- **A runtime.** OCS does not define how activities are delivered, graded or disclosed to
  students.

## 3. JSON, text and digests

### 3.1 JSON documents

Every OCS document is a JSON text ([RFC 8259]) encoded in UTF-8, with no byte-order mark. Its
top-level value is an object.

- Every object defined by this specification is **strict**: a consumer **MUST** refuse an
  object that has a member this specification does not define for it. Nothing rides along
  unvalidated.
- A producer **MUST NOT** write an object with two members of the same name. (Consumer behavior
  for duplicate names is not defined by 1.1; see Appendix E.)
- Numbers that this specification calls integers **MUST** be written without a fraction or
  exponent.

### 3.2 Plain text

Fields this specification calls **plain text** hold text for people to read, never markup. A
plain-text value:

- is a JSON string whose length, after removing leading and trailing white space as
  ECMAScript's `String.prototype.trim` does, is at least 1 and at most the field's stated
  maximum, counted in UTF-16 code units;
- **MUST NOT** match the following case-insensitive regular expression (ECMAScript syntax),
  which detects script and active markup:

  ```
  <\s*\/?\s*(script|iframe|object|embed|applet|style|link|meta|base|form|svg)\b|\b(javascript|vbscript)\s*:|data\s*:\s*text\/html
  ```

A consumer **MUST** refuse a plain-text value that breaks either rule. Ordinary text containing
`<` and `>`, such as "when x < 3 and y > 2", is allowed. The rule is defense in depth: a
consumer that displays package text **MUST** display it as text, never interpret it as markup.

The value a consumer uses is the trimmed text. The digest (Section 3.4) covers the file as
written, untrimmed.

### 3.3 Canonical JSON

The **canonical JSON** of a JSON value is the string produced by ECMAScript's `JSON.stringify`
applied to the value with every object's members sorted by name, where names are compared as
sequences of UTF-16 code units. Arrays keep their order. There is no white space.

For any value obtained by parsing a JSON text, this is the JSON Canonicalization Scheme of
[RFC 8785] (JCS). Implementations **MAY** use any JCS implementation.

The **formatted form** of a value is `JSON.stringify` of the canonically ordered value with an
indent of two spaces, followed by one line feed (U+000A). OCS tools write every file in the
formatted form, and a lockfile **MUST** be written in it (Section 11).

### 3.4 Digests

A **digest** is the string `sha256:` followed by the 64 lowercase hexadecimal digits of a
SHA-256 hash ([FIPS 180-4]). The digest of a JSON value is the digest of the UTF-8 bytes of its
canonical JSON. Two files that differ only in white space or member order therefore have the
same digest. Any change of content changes it.

## 4. Identifiers and versions

### 4.1 Package IDs and export IDs

A **package ID** is a publisher domain, `/`, and a name, matching:

```
^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+/[a-z][a-z0-9-]{0,62}$
```

and at most 200 characters long, for example `northfield.example/biology-9`. The domain keeps
publishers' names apart without a central registry. Writing a domain into an ID does not prove
control of it; publication signatures (Section 15) do that.

An **activity export ID** (Section 14) has the same form, for example
`example.org/biology-foundations-cell-models`.

The **publisher domain** of an ID is the part before the `/`.

### 4.2 Local IDs

A **local ID** names a unit, activity reference, resource reference, Codex note, module or
reading within its document. It matches `^[a-z][a-z0-9-]{0,62}$` (kebab case, starting with a
letter).

### 4.3 Versions

A **version** is `MAJOR.MINOR.PATCH`, three non-negative integers without leading zeros, each
at most nine digits, matching:

```
^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$
```

There are no pre-release or build suffixes in 1.1. Versions are ordered by comparing major,
then minor, then patch, numerically.

A published version is **immutable**. A package store **MUST NOT** accept a version again
unless its content (its digest) is identical. A change is published as a new version.
Publishing tools **SHOULD** derive the next version from the kind of change: a fix bumps the
patch, an addition bumps the minor, and a change that removes or renames units or activities
bumps the major.

### 4.4 Version ranges

A **range** is one or more terms separated by white space, all of which must hold. It is 1 to
100 characters long. A term is:

| Term | Meaning |
| --- | --- |
| `1.2.0` or `=1.2.0` | exactly that version |
| `^1.2.0` | at least 1.2.0 and below the next version that changes the leftmost non-zero component: `^1.2.0` is `>=1.2.0 <2.0.0`, `^0.2.3` is `>=0.2.3 <0.3.0`, `^0.0.3` is `>=0.0.3 <0.0.4` |
| `~1.2.0` | at least 1.2.0 and below the next minor: `>=1.2.0 <1.3.0` |
| `>=1.2.0`, `>1.2.0`, `<=1.2.0`, `<1.2.0` | the comparison |

There is no `||` and no wildcard, so every range is one interval. A range is **exact** if,
after removing surrounding white space and one leading `=`, it is a version.

### 4.5 Digests and district-local references

Digests are as in Section 3.4.

Some references name objects that exist only inside one destination, as the destination's own
systems identify them. Their grammars come from OCS 1.0 and are kept unchanged:

| Reference | Grammar |
| --- | --- |
| Resource release ID | `^rsc_[a-z0-9][a-z0-9-]{0,62}$` |
| Resource release version | `^\d+\.\d+\.\d+$` |
| Activity definition ID | `^adf_[a-z0-9][a-z0-9-]{0,62}$` |
| Activity definition version | a positive integer |

A district-local reference is meaningful only to the destination that issued it. Section 17
describes what happens when a package naming one is installed elsewhere.

## 5. Package layout

A package is a set of files, each identified by a path (a string using `/` as separator). There
are no other files and no directories as such.

```
ocs.json                 manifest (REQUIRED)
ocs.lock                 lockfile (written at publication)
units/<id>.json          one unit per file
activities/<id>.json     one activity reference per file
resources/<id>.json      one resource reference per file
codex/<id>.json          one Codex note per file
```

`<id>` is a local ID (Section 4.2). A consumer **MUST** refuse a package:

- that has no `ocs.json`;
- that has any other path, such as `scripts/setup.js`, `package.json`, `.github/workflows/ci.yml`,
  `units/rules.ts`, or a file in a nested directory;
- that has a file larger than 262,144 bytes (256 KiB) of UTF-8;
- that has more than 2,000 files;
- that has a file that is not valid JSON, or that does not satisfy the schema for its path;
- that has an entry file whose `id` differs from the `<id>` in its path;
- that breaks any rule of Sections 6 to 8.

A consumer **SHOULD** report every problem it finds, not only the first, each with the file
and field it concerns.

Activity definition exports (Section 14) are not package files. Each is a document of its own,
published beside packages.

## 6. The manifest (`ocs.json`)

| Member | Required | Meaning |
| --- | --- | --- |
| `specVersion` | yes | `"1.0"` or `"1.1"` (Section 8). |
| `id` | yes | The package ID (Section 4.1). |
| `version` | yes | The package version (Section 4.3). |
| `title` | yes | Plain text, at most 200. |
| `summary` | no | Plain text, at most 5,000. |
| `subject` | no | One of `english-language-arts`, `science`, `history-social-studies`, `mathematics`, `arts`, `world-languages`, `computer-science`, `health-physical-education`, `social-emotional-learning`, `other`. |
| `gradeBand` | no | A grade or grade range matching `^(K\|\d{1,2})(-\d{1,2})?$`, such as `K`, `7` or `9-12`. |
| `language` | yes | A BCP 47 language tag ([RFC 5646]) matching `^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$`. |
| `standards` | yes | Course-level alignments: at most 100 alignment objects (Section 6.1). May be empty. |
| `modules` | yes | The packages this one includes: at most 50 module references (Section 6.2). May be empty. |
| `outline` | yes | The course order: at most 200 outline entries (Section 6.3). |
| `overrides` | yes | Changes to included content: at most 500 overrides (Section 12.3). May be empty. |

`subject` and `gradeBand` are optional, so a package for adult learners, higher education or
self-directed study simply leaves them out.

### 6.1 Alignments

An alignment is `{ "frameworkKey": string, "competencyUri": string }`. `frameworkKey` is 1 to 100
characters and names a competency framework (for example `ccss-ela` or a CASE framework key).
`competencyUri` is an absolute URI ([RFC 3986]) without white space, at most 2,048 characters,
naming one competency, preferably a CASE identifier. A package carries references to
competencies, never framework content. A destination resolves alignments against its own
approved catalog.

### 6.2 Module references

```json
{ "name": "lab-safety", "package": "labsafe.example/lab-safety", "range": "^1.2.0",
  "digest": "sha256:…", "rights": "embed" }
```

| Member | Required | Meaning |
| --- | --- | --- |
| `name` | yes | A local ID. How this package refers to the module in its outline and overrides. |
| `package` | yes | The included package's ID. |
| `range` | yes | Which versions are acceptable (Section 4.4). |
| `digest` | no | Pins the module's content. Allowed only when `range` is exact. |
| `rights` | no | Caps the use of the module's resources (Section 13): `link`, `embed`, `excerpt` or `licensed-copy`. |

A manifest **MUST NOT** use a module `name` twice, and **MUST NOT** include the same `package`
twice.

### 6.3 Outline

An outline entry is `{ "kind": "unit", "unit": <local ID> }`, one of the package's own units, or
`{ "kind": "module", "module": <module name> }`, all of a module's composed units in the
module's own order. A consumer **MUST** refuse a manifest in which:

- the outline is empty (a course needs at least one unit or module);
- an outline entry names a unit the package does not have, or a module the manifest does not
  declare;
- an entry appears twice, or a unit ID and a module name are the same;
- a declared module is not placed in the outline exactly once;
- an override's first module name (Section 12.3) is not a declared module.

## 7. Package entries

### 7.1 Units

A unit is an ordered sequence of items taught together.

| Member | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Local ID, equal to the file name. |
| `title` | yes | Plain text, at most 200. |
| `summary` | no | Plain text, at most 5,000. |
| `standards` | yes | At most 50 alignments (Section 6.1). |
| `items` | yes | At most 200 items. |

An item is `{ "kind": "activity" | "resource" | "codex", "ref": <local ID> }`, naming an
activity reference, resource reference or Codex note of the same package. Each `ref` **MUST**
name an existing entry of that kind, and the same `ref` **MUST NOT** appear twice in one unit.

### 7.2 Activity references

An activity is a pointer to an activity definition, never the activity's content.

| Member | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Local ID. |
| `title` | yes | Plain text, at most 200. |
| `role` | yes | `lesson`, `assignment` or `assessment`. An assessment is an activity whose definition carries its evidence plan and rubric. |
| `definition` | yes | Either a district-local definition, `{ "definitionId": <activity definition ID>, "version": <positive integer> }` (Section 4.5), or, since 1.1, a portable reference, `{ "portable": { "id": <export ID>, "version": <version>, "digest": <digest> } }` (Section 14). |

### 7.3 Resource references

A resource reference names a released resource and the use the package makes of it.

```json
{ "kind": "release", "id": "goggles", "title": "Goggle rules",
  "release": { "resourceId": "rsc_goggles", "version": "1.0.0" }, "use": "embed" }
```

| Member | Required | Meaning |
| --- | --- | --- |
| `kind` | yes | `release`, or `gadget-blueprint` for an interactive tool distributed as code (below). |
| `id` | yes | Local ID. |
| `title` | yes | Plain text, at most 200. |
| `release` | yes | `{ "resourceId", "version" }`, a district-local resource release reference (Section 4.5). |
| `releaseCommit` | `gadget-blueprint` only | The 40-hexadecimal-digit commit identifier of the tool release that `release` names. |
| `use` | yes | The rights mode the package uses the release under: `link`, `embed`, `excerpt` or `licensed-copy` (Section 13). |

A `gadget-blueprint` resource refers to interactive code **by release only**. Its code, files
and any share link to it **MUST NOT** appear in a package. A destination runs such code only
inside its own sandbox, and only after approving the release.

### 7.4 Codex notes

A Codex note is context for the course written by its author: an overview for students, a guide
for teachers, or an answer key. Assistive tools (including AI assistants) may use it as
context, as data and never as instructions (Section 18).

| Member | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Local ID. |
| `title` | yes | Plain text, at most 200. |
| `body` | yes | Plain text, at most 20,000. |
| `purpose` | yes | `context` or `answer-key`. |
| `visibility` | yes | `students` or `teacher-only`. |

An answer key is always teacher-only: a note with `purpose` `answer-key` **MUST** have
`visibility` `teacher-only`.

## 8. Format versions

`specVersion` is the format version.

- A consumer of this specification **MUST** accept `"1.0"` and `"1.1"` and **MUST** refuse any
  other value.
- A package that contains a portable activity reference **MUST** declare `"1.1"`. A consumer
  **MUST** refuse a package that declares `"1.0"` and contains one.
- A producer **SHOULD** declare `"1.1"` only when the package needs it, so that 1.0 readers keep
  reading everything they can. A package that declared `"1.1"` **MAY** keep declaring it.
- Because every object is strict, a 1.0 reader refuses a document that uses a 1.1 form rather
  than silently ignoring it.
- A later minor version may add optional members or forms. A major version may change meaning
  and needs a migration.
- The lockfile has its own `lockVersion` (Section 11), so the lockfile layout can change
  independently.

## 9. The package digest

The digest of a package is the digest (Section 3.4) of this JSON value: the array of
`[path, canonicalFile]` pairs, one for every file of the package except `ocs.lock`, sorted by
path (compared as UTF-16 code units), where `canonicalFile` is the **string** holding the
canonical JSON of the file's parsed value.

```
digest = "sha256:" + hex(SHA-256(UTF-8(canonicalJson(
           sorted([[path, canonicalJson(JSON.parse(file))] for each file except ocs.lock])))))
```

Reformatting a file or reordering its members does not change the digest. Any change of
content, any added file and any removed file does. The lockfile is excluded because it is
derived from the manifest and the sources; only a course's own lockfile is ever used. A
package's digest can be computed only if every file is JSON and the layout rules of Section 5
on paths, size and count hold.

## 10. Resolution

Resolution turns a course's module ranges into exact versions of every package the course
includes, directly or through other modules.

### 10.1 Package sources

A resolver reads published packages from a **package source** with two operations:

- **list versions** of a package ID: every published version, in any order (empty if unknown);
- **get** one version: its files and the digest recorded when it was published (or nothing).

A source is **not trusted**. For every package version a composer loads, it **MUST**:

1. recompute the package digest and refuse the package (`digest-mismatch`) if it differs from
   the digest the source recorded at publication;
2. if the lockfile in use (Section 10.3) records this package at this version, refuse the
   package (`digest-mismatch`) if its digest differs from the locked digest;
3. read and check the package (Sections 5 to 8), refusing it (`invalid-package`) if it is not
   valid;
4. refuse the package (`identity-mismatch`) if its manifest's `id` and `version` are not the
   ones requested;
5. refuse the package (`digest-mismatch`) if a module reference that requires it pins a
   `digest` that differs.

Version strings returned by a source that are not valid versions (Section 4.3) are ignored.

### 10.2 Algorithm

Each package ID resolves to exactly one version for the whole course (a flat graph), so a
module shared by two others is one version, not two. The algorithm chooses, for each package,
the locked version if it still satisfies every range, otherwise the highest version that does,
and repeats until the choices stop changing. A composer **MUST** produce the same result as
this procedure:

```
selected := {}                             -- package ID -> version
for round := 0, 1, 2, …:
  -- Collect requirements, breadth-first from the course.
  requirements := {}                       -- package ID -> list of (requiredBy, range, digest?)
  queue := [(course ID, course manifest)]; visited := {course ID}
  while queue is not empty:
    (label, manifest) := remove the first element of queue
    for each module m of manifest.modules, in manifest order:
      if m.package = course ID: continue   -- a cycle, reported after selection
      append (label, m.range, m.digest) to requirements[m.package]
      if m.package is in selected and not in visited:
        add m.package to visited
        append ("<m.package>@<selected version>", manifest of that version) to queue

  -- Select one version of each required package, in package ID order.
  chosen := {}
  for each id in requirements, sorted:
    available := the source's versions of id: valid, distinct, newest first
    if available is empty: fail unknown-package(id)
    fitting := versions in available that satisfy every range in requirements[id]
    v := the locked version of id, if it is in fitting; otherwise the first of fitting
    if there is no v: fail version-conflict(id, requirements[id], available oldest first)
    load (id, v) with every check of Section 10.1
    chosen[id] := v

  if chosen has the same IDs and versions as selected: stop
  selected := chosen
  if round = 64: fail version-conflict(…)   -- requirements that never settle

reject cycles (Section 10.5)
write the lockfile (Section 11)
```

A version-conflict failure **SHOULD** report the package, every requirement (who required it and
with which range) and every available version, so that a person can see which modules
disagree. Packages that become unreachable when a selection changes drop out in the next round.

### 10.3 The lockfile as a preference

A composer **MAY** be given a previous lockfile. A locked version is kept while it still
satisfies every range, so adding one module never updates the others. A tool that offers an
update **SHOULD** let the person choose which modules may move, resolve with those packages
removed from the lockfile it passes in, and show every version that moves before publishing.

### 10.4 Why highest-compatible without backtracking (non-normative)

Choosing the highest acceptable version per package, re-evaluated to a fixed point, is
predictable and explainable: a teacher can be told exactly which two modules disagree and which
versions exist. A backtracking solver can find solutions this one misses, but the solution it
finds depends on search order and is much harder to explain. Course graphs are small and
shallow, so OCS prefers a clear conflict ("lab safety: the course needs ~1.0, cells-core 2.0.0
needs ^2.0") to a clever answer.

### 10.5 Cycles

After selection, a composer **MUST** reject a module graph in which a package includes itself,
directly or through others, including a module that includes the course. It walks the graph
depth-first from the course, visiting each package's modules in order of module `name`, and
reports the first loop it finds as the path of package IDs from the first repeated package back
to itself (`cycle`).

## 11. The lockfile (`ocs.lock`)

```json
{
  "lockVersion": 1,
  "packages": [
    { "digest": "sha256:…", "id": "labsafe.example/lab-safety", "modules": [], "version": "1.2.3" }
  ],
  "root": {
    "digest": "sha256:…", "id": "northfield.example/biology-9",
    "modules": [{ "name": "safety", "package": "labsafe.example/lab-safety", "version": "1.2.3" }],
    "version": "1.0.0"
  },
  "specVersion": "1.0"
}
```

| Member | Meaning |
| --- | --- |
| `lockVersion` | `1`. |
| `specVersion` | `"1.1"` if the course or any package it includes declares `"1.1"`, otherwise `"1.0"`. A 1.0 reader therefore refuses a lock whose course it could not compose. |
| `root` | The course: `{ id, version, digest, modules }`. |
| `packages` | Every package the course includes, directly or through modules, excluding the course itself, sorted by `id`. |

Each locked package records its `id`, `version`, `digest`, and `modules`: one
`{ name, package, version }` per module reference in its manifest, with the version selected
for that package, sorted by `name`.

A composer **MUST** write the lockfile in the formatted form (Section 3.3). It contains no
timestamps, host names or source locations, so the same inputs produce the same bytes on any
machine. This is tested byte for byte by the conformance suite.

A package **MAY** be published with its `ocs.lock`. A composer uses only the lockfile of the
course it is composing, never the lockfiles of modules.

## 12. Composition

Composition flattens a resolved course into one ordered outline. It reads only the resolution
(the lockfile and the verified packages), so composing from the same lockfile always gives the
same outline.

### 12.1 Building the outline

Each package's outline is built recursively, given the module path from the course to it (empty
for the course) and the rights cap in force (Section 13):

1. For each outline entry, in order: a `unit` entry contributes that unit of the package; a
   `module` entry contributes the module package's outline, built with the path extended by the
   module's `name` and the cap narrowed by the module's `rights`.
2. Then the package's own overrides are applied, in order, to the units built in step 1.

A module's overrides therefore apply before those of the package that includes it, and the
course always has the last word.

### 12.2 Keys and provenance

Every unit and item has a **key**: the module path joined by `/`, then `:` and the unit ID,
then, for an item, `#` and the item's `ref`. A unit of the course itself has no module part:

```
intro                      a course unit
bio:cells                  unit "cells" of module "bio"
bio/safety:rules#goggles   item "goggles" of unit "rules" of module "safety" of module "bio"
```

Every composed unit and item records its **provenance**: the package ID, the locked version, the
package digest, and the module path.

### 12.3 Overrides

Overrides only reach into modules; a package edits its own units directly. A target names a
module path from the declaring package (`modules`, 1 to 20 module names), a `unit`, and, for
`hide` and `rename`, optionally an `item`.

| Override | Form | Effect |
| --- | --- | --- |
| `hide` | `{ "kind": "hide", "target": { "modules", "unit", "item"? } }` | Leaves the unit or item out of the composed course. It is reported as hidden. |
| `rename` | `{ "kind": "rename", "target": { "modules", "unit", "item"? }, "title": <plain text, at most 200> }` | Gives the unit or item another title in this course, and marks it renamed. |
| `reorder` | `{ "kind": "reorder", "target": { "modules", "unit"? }, "order": [<local ID>, …] }` | Without `unit`, reorders the units whose module path is exactly the target's. With `unit`, reorders that unit's items. Listed IDs come first in the given order, and the rest keep their order after them, within the same positions. Units a nested module contributes keep their positions. `order` holds 1 to 200 distinct IDs. |

A target's module path is resolved relative to the declaring package: the full path is the
declaring package's own path followed by `target.modules`.

An override that matches nothing **MUST** fail composition (`invalid-change`): a unit or item
that is not there, or a reorder that lists an ID that is not in scope. This happens when a
module's new version drops or renames what the override named. It is never silently ignored,
because a hidden answer key that reappears is worse than a failed update.

### 12.4 The composed course

After all overrides are applied, the composer walks the units in order:

- a hidden unit is left out and its key recorded as hidden;
- otherwise, if a unit of the same package with the same unit ID was already kept, the unit is
  left out and its key recorded as **repeated** (this happens when two modules include a shared
  module);
- otherwise the unit is kept, without its hidden items, whose keys are recorded as hidden.

The composed course has the course's `id`, `version`, `title`, `language`, `subject` and
`gradeBand`; the kept units with their items; the hidden keys and the repeated keys, each in
the order found; and its **standards**: the course manifest's standards followed by the
standards of every kept unit, each `(frameworkKey, competencyUri)` pair once, in first-seen
order.

A composed resource item also carries its effective **use** (Section 13).

## 13. Rights propagation

The rights modes are ordered from narrowest to widest:

**`link` < `embed` < `excerpt` < `licensed-copy`**

Each resource reference declares the use its package makes of a release, and each module
reference may declare a `rights` cap. The use a composed course may make of a resource is the
narrowest of its declared use and every cap on the module path from the course to the package
that declares it. Nothing in the format can widen a use: there is no override for rights, and a
cap wider than the declared use has no effect.

This is a ceiling, not a grant. A destination **MUST** still check every release against its
permitted uses before installing a course.

## 14. Portable activities and activity exports

OCS 1.1 adds a portable form of activity reference, so that a course can be installed by a
destination other than the one that authored its activities.

### 14.1 Portable references

```json
{ "portable": { "id": "example.org/poetry-image-response", "version": "1.0.0", "digest": "sha256:…" } }
```

`id` is an activity export ID (Section 4.1), `version` is an exact version, and `digest` pins the
export's content (Section 14.3). The reference is part of the activity file, so the package
digest and the lockfile cover it. Composition carries the reference through unchanged and never
needs the export. The **mapping key** of a reference is `<id>@<version>`.

### 14.2 Activity definition exports

An activity definition export is one strict JSON document holding what a destination needs to
author the same activity in its own systems, and nothing that only means something to the
destination that wrote it. It is data only, and holds student-facing text only: no scope, no
principals, no answer keys and no code.

| Member | Required | Meaning |
| --- | --- | --- |
| `specVersion` | yes | `"1.1"`. |
| `id` | yes | The export ID. |
| `version` | yes | The export version, immutable once published. |
| `language` | yes | A BCP 47 tag, as in Section 6. |
| `activity` | yes | The activity template and its inputs (Section 14.4). |
| `rubric` | no | The rubric, as data (Section 14.5). |
| `alignments` | yes | At most 20 alignments (Section 6.1), by competency URI, each pair at most once. |
| `readings` | no (default `[]`) | At most 20 texts the activity has students read or hear: `{ id, title, body, attribution? }`, where `id` is a local ID unique within the export, `title` plain text at most 200, `body` plain text at most 20,000, and `attribution` plain text at most 500. |

Every string anywhere in an export **MUST** satisfy the active-content rule of Section 3.2. An
export file **MUST NOT** exceed 262,144 bytes. Every reading ID that `activity.resources` or
`activity.sources` names **MUST** be a reading of the export.

Answer keys and teacher guides belong in the course's teacher-only Codex notes, never in an
export.

### 14.3 The export digest

The digest of an export is the digest (Section 3.4) of the parsed export file, as written, with
no defaults filled in. Formatting and member order do not change it.

### 14.4 Activity templates

`activity` is discriminated by `template`. Every template has these common members:

| Member | Required | Meaning |
| --- | --- | --- |
| `template` | yes | One of the six templates below. |
| `title` | yes | Text, 1 to 200 characters after trimming. |
| `subject` | yes | A subject (Section 6). |
| `gradeBand` | yes | A grade band (Section 6). |
| `overview` | yes | Text, 1 to 5,000. |
| `resources` | no (default `[]`) | At most 20 reading IDs, in the order students meet them. |
| `aiHelp` | yes | How much AI help students may have with the activity: `full`, `hints-only` or `none`. A destination may narrow it. |
| `additionalArtifactTypes` | no (default `[]`) | At most 12 extra kinds of work students may submit beyond what the template asks for: `document`, `notebook`, `spreadsheet`, `presentation`, `dataset`, `image`, `audio`, `video`, `interactive`, `evidence`, `portfolio`, `external-ref`. |
| `due` | yes | `{ "kind": "none" }`, or `{ "kind": "after-install", "days": 1–365 }`. Never a fixed date, which suits only one destination's calendar. |
| `collaboration` | no (default `individual`) | `individual` or `group`. |

Template-specific members ("text n" means a string of 1 to n characters after trimming):

| `template` | Members |
| --- | --- |
| `writing-task` | `prompt` (text 5,000); `genre`: `argument`, `informative`, `narrative` or `literary-analysis`; `minWords` (optional integer 1–20,000); `minimumCitations` (integer 0–50) |
| `science-investigation` | `question` (text 2,000); `methodPrompt` (text 5,000); `dataColumns`: 1–30 of `{ "name": text 100, "unit"?: text 50 }`; `analysisPrompt` (text 5,000) |
| `primary-source-analysis` | `sources`: 1–20 reading IDs; `sourcingQuestions` and `contextualizationQuestions`: each 1–20 texts of 1,000; `claimPrompt` (text 5,000); `minimumEvidence` (integer 1–20) |
| `problem-set` | `problems`: 1–50 of `{ "prompt": text 5,000 }` (prompts only: answers belong in a teacher-only answer key); `showWork` (boolean) |
| `picture-response` | `lookPrompt` (text 1,000); `drawPrompt` (text 500); `tellAboutIt` (boolean, default `true`); `sentenceFrames` (at most 10 texts of 200, default `[]`) |
| `read-and-respond` | `passage` (text 3,000); `questions`: 1–10 of `{ "prompt": text 500, "answerBy"?: "speaking" \| "drawing" \| "writing" }`; `answerBy` (default `speaking`); `sentenceFrames` (as above) |

### 14.5 Rubrics

A rubric is `{ "title": plain text 200, "criteria": [...] }` with 1 to 50 criteria, whose IDs
are unique. A criterion is `{ "id", "title": plain text 200, "description"?: plain text 2,000,
"levels": [...] }` with 1 to 10 levels, whose IDs are unique, listed lowest first, each worth
strictly more points than the one before. A level is `{ "id", "label": plain text 200, "points":
number 0–1,000 }`. Criterion and level IDs match `^[a-z0-9][a-z0-9-]{0,62}$`.

A rubric is data. It carries no evaluator configuration (which may hold answer keys) and no
instructions for an AI.

### 14.6 Export sources

Exports are published to the same package stores as packages, under the same rules: immutable
versions, digests and publisher signatures (Section 15). An export source has the same two
operations as a package source (Section 10.1). Before installing a course, a consumer resolves
its exports: for every portable reference in the composed course, in course order, it gets that
export version and **MUST** refuse it if it is missing (`unknown-export`), if its digest differs
from the digest the source recorded or from the reference's digest, or if it is another export
or version (`export-mismatch`). Two references to the same `id@version` that pin different
digests **MUST** be refused (`export-mismatch`).

## 15. Publication signatures

A publisher signs each package version and export version it publishes. A destination accepts a
package or export from outside its own domains only with a valid signature by a key it approved
for that publisher's domain.

### 15.1 Keys

Signatures use Ed25519 ([RFC 8032]). A public key is its 32 raw bytes in unpadded base64url
([RFC 4648] §5), 43 characters. A **key ID** is `ed25519-` followed by the unpadded base64url
SHA-256 of the raw public key (43 characters), so a key ID can never be pointed at a different
key.

A **publisher key** a destination trusts is `{ "keyId", "publicKey", "retiresAt"? }`, where
`retiresAt` is an RFC 3339 UTC date-time ending in `Z`. A key is trusted only before its
`retiresAt`, which gives rotations an overlap.

A **trust configuration** is the destination's list of `localDomains` (its own publishing
domains, at most 20, whose packages need no signature) and `publishers`, at most 200 entries
of `{ "domain", "keys": [1–16 publisher keys] }`. Each key list is pinned to one domain: a key
approved for one publisher can never sign another publisher's packages. Only the destination
changes its trust configuration.

A publisher **MAY** publish its public keys as a **publisher key document**,
`{ "domain", "keys": [publisher keys] }` (schema `publisher.schema.json`). A destination decides
whether to approve them. Nothing published with a signature is ever trusted as a key.

### 15.2 Statements and signed bytes

A **package publication** statement is:

```json
{ "packageId": "…", "version": "…", "digest": "sha256:…", "publishedAt": "2026-11-04T12:00:00Z" }
```

and an **activity export publication** statement is
`{ "exportId", "version", "digest", "publishedAt" }`. `publishedAt` is an RFC 3339 UTC
date-time ending in `Z`.

The bytes signed are the UTF-8 encoding of the signing context, a NUL character (U+0000), and
the canonical JSON (Section 3.3) of the statement. The signing contexts are fixed strings, each
containing one NUL:

| Statement | Signing context |
| --- | --- |
| Package publication | `educateos-ocs/v1` NUL `package-publication` |
| Activity export publication | `educateos-ocs/v1` NUL `activity-export-publication` |

The contexts keep their historical names (Appendix C). Because the context is part of the
signed bytes, a package signature never verifies as an export signature, nor the reverse, nor as
any other message signed with the same key. A verifier **SHOULD** also accept a package
publication signed in the legacy context `schoolos-ocs/v1` NUL `package-publication`. Producers
**MUST NOT** use the legacy context.

A **signature envelope** is:

```json
{ "payload": { …statement… }, "signature": "<86 base64url characters>", "keyId": "ed25519-…" }
```

### 15.3 Verification

To decide whether a package (or export) may enter a destination's store, a verifier:

1. accepts it unsigned if its publisher domain is one of the trust configuration's
   `localDomains`;
2. otherwise refuses it (`unsigned`) if there is no envelope, or (`bad-signature`) if the
   envelope is malformed;
3. finds the key with the envelope's `keyId` among the keys approved for the publisher domain,
   and refuses (`unknown-publisher`) if there is none, if it has retired (the verification time
   is at or after `retiresAt`), or if its `keyId` is not the key ID of its `publicKey`;
4. verifies the Ed25519 signature over the signed bytes of the envelope's `payload`, in the
   statement's signing context, and refuses (`bad-signature`) if it does not verify;
5. refuses (`bad-signature`) if the payload is not a valid statement of the expected kind;
6. refuses (`wrong-package`) unless the statement's ID, version and digest are exactly those of
   the package or export being checked.

A store **SHOULD** keep the accepted envelope with the version. Composers still check every
package's digest (Section 10.1), so a signed version that changes in storage is refused as well.

## 16. Bundles

A **bundle** distributes a course as one JSON document: the course package version, the
packages it includes and the exports they name, each as published, with its digest and its
publisher signature.

| Member | Meaning |
| --- | --- |
| `format` | `"educateos.ocs-bundle.v1"` (a fixed identifier with a historical name). |
| `course` | `{ id, version, digest }` of the course package. |
| `packages` | 1 to 100 bundled packages: the course first, then every package it includes, sorted by ID then version. A bundled package is `{ id, version, digest, files, signature? }`, where `files` maps each path to the file's text exactly as published, and `signature` is a package publication envelope. |
| `exports` | At most 500 bundled exports, sorted by ID then version: `{ id, version, digest, text, signature? }`, where `text` is the export file as published and `signature` an export publication envelope. |

A bundle is not trusted. A consumer opening a bundle **MUST**:

- refuse a malformed bundle;
- refuse a bundle in which the same package `id@version`, or the same export `id@version`,
  appears twice;
- read and check every package and export, and refuse the bundle if any is invalid, or if its
  ID, version or digest is not the one its bundle entry records;
- refuse the bundle unless its first package is the course its `course` member names;
- verify every package and export signature as in Section 15.3, against the consumer's own trust
  configuration, and refuse the bundle if any is refused.

A consumer then installs from the bundle alone: it resolves the course with its own lockfile
against the bundle's packages, composes it, and resolves its exports from the bundle's exports.

## 17. Installation

This section describes how a destination turns a composed course into its own records. The
destination's systems are outside OCS, so most of this section is informative. Its
**MUST**-level rules protect students and destinations.

A destination plans an installation from the composed course and its verified exports, unit by
unit and item by item, in course order:

- an **activity** is installed once, at its first place in the course; a later item naming the
  same definition (or the same portable `id@version`) is reported as repeated;
- a **Codex note** visible to students becomes student-facing content; a **teacher-only note**
  (a teacher guide or an answer key) becomes teacher-only content. A destination **MUST NOT**
  show a teacher-only note to students;
- a **resource** is placed with its effective use (Section 13), after the destination has checked
  the release against its permitted uses.

For each portable activity the destination imports the export **once**, as a new draft activity
definition in its own systems: its readings become the destination's own resources, its rubric
the destination's own rubric, and its alignments are resolved only against the destination's
approved catalog. A destination **MUST NOT** reuse a definition ID from another destination. It
records the mapping from the reference's mapping key to its local definition, so a later run can
resume. Drafts may be left for review; the activities that use them are then reported as pending
and installed by a later run.

A package that names a district-local definition (Section 4.5) that the destination does not
hold **MUST** fail to install that activity, visibly.

A package grants nothing. Installation is authorized and validated by the destination's own
systems for the person installing it.

## 18. Security considerations

- **No executable code.** The layout admits only JSON files at fixed paths, every object is
  strict, and text fields are plain text. Consumers **MUST NOT** execute, import or evaluate
  anything in a package or export, and **MUST** treat a package that holds anything outside the
  layout as invalid rather than skipping the extra file. Renderers **MUST** render package text as
  text.
- **Interactive tools by release only.** Code for interactive tools appears only as a reference
  to a release that the destination approves and runs in its own sandbox (Section 7.3). Share
  links, which are bearer capabilities, never appear in a package that may be exported or
  shared.
- **Untrusted sources and mirrors.** Every package is verified by digest, ID and version
  (Section 10.1), every export by digest, ID and version (Section 14.6), and every bundle part
  likewise (Section 16). A tampered mirror, a source that substitutes another package, or a
  version republished with different content is refused.
- **Publisher authenticity.** Digests prove content equality, not origin. Signatures with keys
  pinned per publisher domain (Section 15) prove origin. Neither proves that the content is
  accurate or appropriate; review is the destination's job.
- **Imported text is data.** Package and export text that reaches an AI assistant **MUST** be
  delimited and treated as untrusted content, never as instructions, whatever it says.
- **No authority.** A package or bundle grants no permission. Installation is authorized by the
  destination.
- **Resource limits.** The limits on file size, file count, list lengths and resolution rounds
  bound the work a hostile package can cause. Consumers **SHOULD** enforce them before parsing
  more than necessary.
- **Answer keys.** Answer keys are teacher-only by construction (Section 7.4) and are never in
  exports (Section 14.2).

## 19. Privacy considerations

A package, export or bundle **MUST NOT** contain rosters, student identifiers, submissions,
grades, student work, or credentials of any kind. Publishers **SHOULD** check readings and notes
for personal information before publishing. Because published versions are immutable and may be
mirrored, information published by mistake cannot be withdrawn; a new version can only stop
distributing it.

## 20. Relation to other formats

| Format | Relation | What does not carry over |
| --- | --- | --- |
| Thin Common Cartridge 1.3 | Import and export adapter. Importing: each top-level module becomes a unit holding the web links beneath it that the destination has released as resources. Exporting: each of a package's own units becomes a module of web links to its releases' locators. | To OCS: LTI tools, links that are not released, nesting below the top level, standards claims (which are not reviewed alignments), descriptive metadata, and titles that are not plain text. To Thin CC: modules, overrides, activities, Codex notes (answer keys never leave), interactive tools, releases without a public locator, rights uses and standards. An adapter **SHOULD** return the list of what it could not carry. OCS is not "Thin CC with extras" and must not be described as Thin CC. |
| Common Cartridge 1.3 | Export adapter for LMS hand-off. | Module structure is flattened; activity semantics reduce to links or LTI placements. |
| CASE 1.1 | Alignments name competencies by CASE URI; destinations mirror CASE frameworks into their catalogs. | OCS carries references, never framework content. |
| LTI 1.3 | External tools are resources launched through the destination's own registration. | Launch configuration and keys never appear in a package. |
| Git | A package store may keep packages in Git, and a package directory is a natural repository. | Nothing in the format depends on Git, and teachers never need to see it. |

## 21. Conformance

A product claims conformance to OCS 1.1 in one or more of these classes. A claim **SHOULD** name
the classes and the version of the conformance suite it passes.

### 21.1 Producer

A conforming producer writes documents that every conforming consumer accepts:

- every package it writes satisfies Sections 3 to 8;
- every export it writes satisfies Section 14.2 to 14.5;
- it declares `specVersion` `"1.1"` exactly when Section 8 requires it, or later;
- it never republishes a version with different content (Section 4.3);
- it **SHOULD** write every file in the formatted form (Section 3.3).

### 21.2 Consumer

A conforming consumer:

- accepts every valid package and export, and refuses every invalid one, as Sections 3 to 9 and
  14 require;
- computes package and export digests exactly as Sections 9 and 14.3 define;
- never executes, imports or fetches anything a package names (Section 18);
- **SHOULD** report each problem with its file and field, using the problem kinds of
  Appendix B.

### 21.3 Composer

A conforming composer is a conforming consumer that also:

- resolves exactly as Section 10 defines, with every source check of Section 10.1;
- writes lockfiles byte-identical to those Section 11 defines;
- composes exactly as Sections 12 and 13 define, including keys, provenance, hidden and repeated
  units, and effective uses;
- fails, rather than guesses, on every failure this specification names.

### 21.4 Optional capabilities

- **Signature verifier:** verifies publication signatures as Section 15.3 defines.
- **Bundle reader:** opens bundles as Section 16 defines (requires the signature verifier).
- **Installer:** follows the **MUST**-level rules of Section 17.

### 21.5 Conformance suite

The conformance suite in `conformance/` (in this repository) has valid and invalid fixtures with
their expected results, including byte-identical lockfiles and digest, composition, integrity and
signature cases. Passing it is necessary but not sufficient for conformance.

## Appendix A. Implementations (non-normative)

This appendix records implementation notes that are not part of the standard.

### A.1 Reference implementation

`packages/ocs` (`@open-course-standard/ocs`, in this repository) is the reference implementation:
a TypeScript library for Node.js 20+ and browsers, with the `ocs` command-line tool. It is
generated from, and tested against, the same validators as the JSON Schemas.

### A.2 EducateOS

EducateOS, where OCS was first specified, implements OCS 1.1 in its `@educateos/ocs` package.
Notes specific to it:

- A district's course library is a Durable Object SQLite store. A published version is
  immutable: the table refuses any update or delete, and publishing a version again succeeds only
  with identical content. Every publication passes the district's publication policy, which
  checks publisher signatures (Section 15).
- Activities run through the EducateOS curriculum service. A district-local activity definition
  reference (`adf_…`) names a published `ActivityDefinition` version there, and installation goes
  through that service, which authorizes the teacher for the class and validates each activity.
- Resource releases (`rsc_…`) are EducateOS Content Studio releases. Whether a release permits a
  use is decided by the Content Studio review and checked again at installation.
- The `subject` and `gradeBand` vocabularies, the district-local ID grammars and the activity
  templates of Section 14.4 are the EducateOS contracts and curriculum templates, which OCS 1.0
  and 1.1 adopted.
- Package text reaching the EducateOS AI helper is handled like other Codex content: delimited,
  never instructions.
- `educateos.io` distributes public sample courses as signed bundles. It is never required, and
  never in the student data path.

## Appendix B. Problem kinds

Consumers and composers **SHOULD** report failures with these kinds, which the conformance suite
uses.

| Kind | Meaning |
| --- | --- |
| `invalid-package` | A package's files are not a valid package (Sections 5 to 8, 9). |
| `unknown-package` | No published versions of a package, or not the version requested. |
| `version-conflict` | No single version satisfies every range, or requirements never settle. |
| `cycle` | Modules include each other in a loop. |
| `digest-mismatch` | A package's content does not match a recorded, locked or pinned digest. |
| `identity-mismatch` | A source returned a package whose ID or version is not the one requested. |
| `invalid-change` | An override matches nothing. |
| `invalid-export` | An activity export is not valid. |
| `unknown-export` | No source holds the export version a portable reference names. |
| `export-mismatch` | An export's content, ID or version is not what its reference or publication recorded, or two references pin different content. |
| `unmapped-activity` | A portable activity has not been imported by the destination. |

Signature refusals (Section 15.3) are `unsigned`, `unknown-publisher`, `bad-signature` and
`wrong-package`.

## Appendix C. History and name

OCS 1.0 and 1.1 were designed and first published as the EducateOS **"Open Course
Specification"**, RFC 0001 in the EducateOS repository, implemented by `@educateos/ocs`. In
November 2026 the format was published as the vendor-neutral **Open Course Standard (OCS)** in
this repository, merged with ideas from the earlier v0.1 "Open Course Standard" proposal; see
[docs/decisions.md](../docs/decisions.md).

Identifiers that appear on the wire keep their original names so that every course already
published stays valid: the signing contexts beginning `educateos-ocs/v1` and the bundle format
`educateos.ocs-bundle.v1`. They are fixed identifiers, not claims about who implements OCS.

## Appendix D. Changes from 1.0 to 1.1

1.1 adds portable activities and changes nothing else. A 1.1 reader reads every 1.0 package and
lockfile.

- `specVersion` may be `"1.1"`, and must be for a package with a portable activity (Section 8).
- Activity references may be portable (Section 14.1).
- Activity definition exports, their digest, their publication signatures, and export sources
  (Sections 14.2 to 14.6, 15).
- A lockfile is `"1.1"` when the course or any package it includes is 1.1 (Section 11).
- Bundles (Section 16).

## Appendix E. Open questions

These questions are open for future RFCs.

1. **Duplicate units across modules.** 1.1 shows a shared unit once, at its first position.
   Should a course be able to choose the position, or show both?
2. **Pre-release versions.** Should publishers be able to offer `2.0.0-beta.1` to teachers who opt
   in, and how is that explained without developer vocabulary?
3. **Stable item identity.** Overrides name items by local ID, so a module that renames an
   internal ID breaks overrides loudly (Section 12.3). Is a stable identity across versions worth
   its cost?
4. **Rights caps per resource.** 1.1 caps per module. Is a per-resource cap needed, and can it
   stay narrow-only?
5. **Duplicate JSON member names.** Should consumers be required to refuse them?
6. **Level-neutral context.** Activity exports require a K-12 `gradeBand`. A level-neutral
   educational context field (for example an ISCED level) would let higher-education and adult
   courses use portable activities.
7. **Deferred profiles from v0.1:** progressive disclosure, learner workspaces and student
   contributions, assessment evidence records and approvals, and MCP, OpenAPI and LTI runtime
   profiles. See [docs/decisions.md](../docs/decisions.md).

## References

- [RFC 2119] Key words for use in RFCs to Indicate Requirement Levels.
- [RFC 8174] Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words.
- [RFC 8259] The JavaScript Object Notation (JSON) Data Interchange Format.
- [RFC 8785] JSON Canonicalization Scheme (JCS).
- [RFC 3986] Uniform Resource Identifier (URI): Generic Syntax.
- [RFC 4648] The Base16, Base32, and Base64 Data Encodings.
- [RFC 5646] Tags for Identifying Languages.
- [RFC 8032] Edwards-Curve Digital Signature Algorithm (EdDSA).
- [FIPS 180-4] Secure Hash Standard.
- 1EdTech Common Cartridge 1.3, Thin Common Cartridge, CASE 1.1, LTI 1.3.

[RFC 2119]: https://www.rfc-editor.org/rfc/rfc2119
[RFC 8174]: https://www.rfc-editor.org/rfc/rfc8174
[RFC 8259]: https://www.rfc-editor.org/rfc/rfc8259
[RFC 8785]: https://www.rfc-editor.org/rfc/rfc8785
[RFC 3986]: https://www.rfc-editor.org/rfc/rfc3986
[RFC 4648]: https://www.rfc-editor.org/rfc/rfc4648
[RFC 5646]: https://www.rfc-editor.org/rfc/rfc5646
[RFC 8032]: https://www.rfc-editor.org/rfc/rfc8032
[FIPS 180-4]: https://csrc.nist.gov/pubs/fips/180-4/upd1/final
