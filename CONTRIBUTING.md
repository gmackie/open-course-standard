# Contributing to OCS

Thank you for helping. OCS is a young open standard. Issues and pull requests are welcome from
teachers, publishers, platform builders and researchers.

## What kind of change is it?

| Change | Process |
| --- | --- |
| Typo, clarification, broken link, tooling, CI | An ordinary pull request. |
| New conformance fixture for existing behaviour | A pull request with the fixture and its expected result. |
| Bug in the reference implementation | A pull request with a failing test, then the fix. If the spec and the implementation disagree, say which one you think is right. |
| Any change to what a MUST, SHOULD or MAY requires, to a schema, or to a digest or lockfile byte | An RFC (see [GOVERNANCE.md](GOVERNANCE.md)). |

## Writing an RFC

1. State the problem with at least one real educational example. OCS is meant to work from
   kindergarten to graduate research and self-directed study, so say who your example is for.
2. Say which conformance class the change affects: producer, consumer or composer.
3. Use RFC 2119 / RFC 8174 keywords (**MUST**, **SHOULD**, **MAY**) only for requirements a
   test can check, and add conformance fixtures for each new MUST.
4. Update the JSON Schemas and the reference implementation, or explain why the change cannot
   be expressed there.
5. Cover backward compatibility, security, privacy and rights (licensing) consequences.
6. Explain how the change relates to existing standards (Common Cartridge, CASE, LTI, QTI) and
   to earlier RFCs.

## Development

This repository uses **pnpm** (pinned by `packageManager` in `package.json`) and Node.js 22 or
later for development. The reference implementation itself runs on Node.js 20+ and in browsers.

```sh
corepack enable
pnpm install
pnpm check        # every check CI runs
```

Commits and pull requests should be small and focused. CI must pass before a pull request is
merged.

## Fixtures and examples

- Keep every name, school and student in a fixture fictional. Use `example`, `example.org`,
  `example.edu` and other reserved domains for publisher IDs unless the publisher has agreed
  otherwise.
- Never commit real student data, real grades, unreleased assessments, answer keys from a real
  course, access tokens or private keys. The only private key in the repository is the
  conformance test key, which is public test material and must never be trusted by anything.
- Only add course content you have the right to license under the terms in [LICENSE](LICENSE).
  Quote public-domain or openly licensed texts and say so in the content's attribution.

## License of contributions

By contributing you agree that your contribution is licensed under the license that covers the
files you change, as set out in [LICENSE](LICENSE): Apache-2.0 for code and CC-BY-4.0 for the
specification, schemas, fixtures, examples and documentation.
