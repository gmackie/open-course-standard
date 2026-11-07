# @open-course-standard/ocs

The reference implementation of the [Open Course Standard (OCS) 1.1](https://github.com/gmackie/open-course-standard/blob/main/spec/ocs-1.1.md),
with the `ocs` command-line tool.

- Reads and validates course packages and activity exports, refusing anything outside the format.
- Computes package and export digests.
- Resolves modules into a deterministic, byte-identical lockfile.
- Composes a course's outline, with overrides, provenance and rights propagation.
- Signs and verifies publisher signatures, and builds and opens bundles.
- Plans installations at a destination.
- Converts to and from Thin Common Cartridge.

The library uses web-standard APIs only (Web Crypto, `TextEncoder`), so it runs in **Node.js 20+
and browsers**. Its one dependency is [Zod](https://zod.dev). Filesystem helpers and the CLI are
Node.js only.

> **Status:** ready to publish to npm, not yet published. Until it is, build it from this
> repository: `pnpm install && pnpm --filter @open-course-standard/ocs build`.

## The `ocs` tool

```sh
ocs validate <path>...                 # packages, store directories, exports, bundles, publisher keys, lockfiles
ocs inspect <package-dir> --store <dir>
ocs lock <package-dir> --store <dir> [--check] [--update [<module>...]]
ocs verify <bundle.json> --trust publisher.json
ocs verify <package-dir> --store <dir>  # every locked package still has its locked digest
ocs compose <package-dir> --store <dir>
ocs export-thin-cc <package-dir> --out course.imscc [--locators locators.json]
```

`ocs --help` has the details. Exit status: 0 on success, 1 when a check fails, 2 on misuse.

### Package store directories

`--store` names a directory laid out like this (a convention of this tool, not part of the
standard):

```
<store>/<domain>/publisher.json              optional publisher key document
<store>/<domain>/activities/<name>.json      activity export <domain>/<name>
<store>/<domain>/<name>/ocs.json …           package <domain>/<name> (one version), or
<store>/<domain>/<name>/<version>/ocs.json   one directory per version
<store>/bundles/…                            bundles, checked against the store's publisher keys
```

`ocs validate <store>` checks everything in a store. Packages are resolved against the store
itself, every `ocs.lock` must be current, and every portable activity must match its export.

## The library

```ts
import { composeCourse, readPackage, resolveCourse, serializeLock, InMemoryPackageLibrary } from "@open-course-standard/ocs";

const library = new InMemoryPackageLibrary(); // or any PackageSource: { listVersions, getPackage }
await library.publish(moduleFiles);           // files: { "ocs.json": "...", "units/x.json": "..." }
const course = await readPackage(courseFiles);
const resolution = await resolveCourse(course, library, { locked: course.lock });
const lockText = serializeLock(resolution.lock);   // byte-identical everywhere
const outline = composeCourse(resolution);         // units, items, provenance, hidden, repeated
```

Failures are `OcsError`s carrying a structured `problem` (`invalid-package`, `version-conflict`,
`digest-mismatch`, and the other kinds in Appendix B of the specification) and a plain-language
message.

`@open-course-standard/ocs/node` adds `readPackageDirectory`, `DirectoryStore` (a package store
directory used as a package and export source) and `writeZip`.

## Provenance

This package is a standalone port of `@educateos/ocs`, the implementation that first defined OCS
1.0 and 1.1 in [EducateOS](https://github.com/gmackie/educate-os). The port has no Cloudflare or
EducateOS dependency. The schemas in `schemas/1.1/` are generated from its validators
(`pnpm schemas`).

## License

Apache-2.0.
