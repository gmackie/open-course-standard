# Security

## Reporting a vulnerability

Report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/gmackie/open-course-standard/security/advisories/new)
for this repository. Do not open a public issue for a vulnerability, and do not include real
student data in a report.

You should get an acknowledgement within seven days. Fixes to the specification are published
as errata or a new version and listed in the changelog. Fixes to the reference implementation
are released with an advisory.

## Scope

In scope:

- the reference implementation and the `ocs` command-line tool (`packages/ocs`);
- the conformance runner;
- weaknesses in the specification itself, such as a rule that lets a package carry executable
  content, bypass a digest or signature check, widen the rights a course may use, or leak
  teacher-only material to students.

Out of scope: vulnerabilities in a particular product that implements OCS. Report those to that
product's maintainers.

## The security model, in short

The specification's security section is normative. Its main rules:

- **A package is data.** It holds only JSON files at fixed paths. Every object is strict, so
  unknown fields are refused, and text fields are plain text. Text that contains script or
  active markup is refused as defense in depth, and renderers must still render package text as
  text. Reading, composing or importing a package never runs anything.
- **Sources are untrusted.** A consumer recomputes every package's digest and checks its
  identity and version against what it asked for and against the lockfile. A tampered mirror, a
  substituted package, or a version republished with different content is refused.
- **Signatures are pinned per publisher.** A publisher signature is accepted only from a key the
  consumer approved for that publisher's domain. A key carried with a signature is never
  trusted.
- **Rights only narrow.** Including a module can cap the use a course makes of a resource, never
  widen it.
- **A package grants nothing.** It carries no credentials, roster data, grades or student work.
  Installing a course goes through the destination's own authorization.
- **Imported text is data.** Text from a package that reaches an AI assistant must be treated
  as untrusted content, never as instructions.

The reference implementation reads local files and does not execute package content, fetch
from the network, or import plugins. It is a validator and composer, not a sandbox: run it on
untrusted input with ordinary operating-system protections and without elevated privileges.
