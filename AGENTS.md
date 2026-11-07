# Guidance for contributors and coding agents

- OCS is a **vendor-neutral** and **level-neutral** format. Do not add a required grade level,
  term, credit system, institution, LMS, Git host or AI vendor to the core format.
- The specification in `spec/` is normative. The JSON Schemas in `schemas/` are normative for
  structure and are generated from the reference implementation's validators
  (`pnpm --filter @open-course-standard/ocs schemas`). Never edit a generated schema by hand.
- Any change to a MUST, SHOULD or MAY, to a schema, to a digest or to lockfile bytes needs an
  RFC, conformance fixtures and a changelog entry (see `GOVERNANCE.md`).
- Packages are data. Never add code paths that execute, import or fetch package content.
- Keep fixtures and examples fictional. Never commit real student data, real answer keys,
  tokens or private keys. The conformance test key is the only private key, and it is public
  test material.
- Use pnpm, not npm. Run `pnpm check` before pushing.
