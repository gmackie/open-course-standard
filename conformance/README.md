# OCS 1.1 conformance suite

Fixture packages and documents with their expected results, and a runner that tests any
implementation through a small adapter. Passing the suite is necessary but not sufficient for
conformance; the requirements are in [spec §21](../spec/ocs-1.1.md#21-conformance).

```sh
pnpm install && pnpm build
node conformance/run.mjs                                  # the reference implementation
node conformance/run.mjs --adapter "./my-ocs-adapter"     # your implementation
node conformance/run.mjs --filter resolve/ --json         # some cases, machine-readable
```

## Cases

[`cases/index.json`](cases/index.json) lists every case. Each case is a directory with a
`case.json`:

```json
{
  "id": "resolve/diamond-one-version",
  "kind": "resolve",
  "description": "…",
  "spec": ["§10.2"],
  "input": { "course": "course", "store": "store" },
  "expect": { "lock": "expected.lock" }
}
```

| Kind | Tests | Classes | Cases |
| --- | --- | --- | --- |
| `package` | reading a package: layout, strict objects, plain text, references, format versions, and the package digest (including that formatting, member order and `ocs.lock` do not change it) | consumer | 37 |
| `export` | reading an activity export and its digest | consumer | 13 |
| `resolve` | resolution and **byte-identical lockfiles**: ranges, locked versions, diamonds, conflicts, cycles, digest pins, tampered mirrors, substituted packages, format-version propagation, and a reformatted store that must give the same bytes | composer | 22 |
| `compose` | composition: module placement, keys, provenance, overrides (hide, rename, reorder), nested overrides, rights narrowing, repeated units, standards | composer | 6 |
| `bundle` | opening a bundle: digests and publisher signatures against a trust configuration | bundle reader | 7 |
| `publication` | verifying a package or export publication signature, including signing contexts | signature verifier | 6 |

An implementation that does not claim a class may skip its kinds with `--filter`.

### Inputs

All paths in `input` are relative to the case directory.

- A **package** is a directory of package files.
- A **store** is `store/<domain>/<name>/<version>/` per package version. Its optional
  `store/published-digests.json` maps `id@version` to the digest the source recorded at
  publication; without an entry, the recorded digest is the digest of the files. (A digest there
  that differs from the files is a tampered mirror.)
- `lock` is a previous lockfile to resolve with (spec §10.3).
- `trust` is a trust configuration (`schemas/1.1/trust.schema.json`); `at` is the verification
  time.

## The adapter protocol

The runner starts the adapter command once per request (twice for `resolve` cases, to check
determinism). It writes one JSON request to the adapter's stdin and reads one JSON response from
its stdout. The adapter exits 0. A non-zero exit fails the case.

Request: `{ "kind": "<case kind>", "caseDir": "<absolute path>", "input": { … } }`

| Kind | Response |
| --- | --- |
| `package`, `export` | `{ "valid": true, "digest": "sha256:…" }` or `{ "valid": false, "problem": "<problem kind>" }` |
| `resolve` | `{ "lock": "<the lockfile text>" }` or `{ "problem": "<problem kind>" }` |
| `compose` | `{ "outline": <outline> }` or `{ "problem": "<problem kind>" }` |
| `bundle` | `{ "accepted": true }` or `{ "accepted": false, "reason": "unsigned" \| "unknown-publisher" \| "bad-signature" \| "wrong-package" \| "invalid" }` |
| `publication` | `{ "ok": true, "signed": <boolean> }` or `{ "ok": false, "reason": "unsigned" \| "unknown-publisher" \| "bad-signature" \| "wrong-package" }` |

Problem kinds are those of spec Appendix B. A `lock` must be **byte-identical** to the case's
`expected.lock`. An `outline` is compared structurally with `expected-outline.json`:

```json
{
  "packageId": "…", "version": "…",
  "units": [{ "key": "…", "title": "…", "renamed": false,
              "provenance": { "packageId": "…", "version": "…", "digest": "sha256:…", "modules": ["…"] },
              "items": [{ "key": "…", "kind": "activity|resource|codex", "title": "…", "renamed": false, "use": "…" }] }],
  "hidden": ["…"], "repeated": ["…"],
  "standards": [{ "frameworkKey": "…", "competencyUri": "…" }]
}
```

`use` appears on resource items only. The reference adapter is `ocs conformance-adapter`
(`packages/ocs/src/node/conformance.ts`).

## Test keys

`keys/` holds the Ed25519 keys that signed the bundle and publication fixtures, **including their
private keys**. They are public test material. Never trust them for anything else.

## Changing the suite

The fixtures are built by [`tools/build-fixtures.ts`](tools/build-fixtures.ts):

```sh
node --experimental-strip-types conformance/tools/build-fixtures.ts
```

Each case states by hand what it expects of invalid input. For valid input, the expected digest,
lockfile or outline was computed once by the reference implementation and is frozen in the
committed fixture. A later change to the implementation therefore fails the suite instead of
silently moving an expectation. Changing an expectation is a normative change and needs an RFC
(see [GOVERNANCE.md](../GOVERNANCE.md)).

Fixtures are CC-BY-4.0. The runner and tools are Apache-2.0.
