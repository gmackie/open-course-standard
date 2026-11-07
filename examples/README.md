# Examples

Every example here is validated in CI with `ocs validate` and against the JSON Schemas.

| Directory | What it shows | License |
| --- | --- | --- |
| [level-neutral/](level-neutral/) | The five examples of the v0.1 proposal, converted to OCS 1.1: a poetry course with no level at all, secondary biology with a portable assessment, an undergraduate laboratory, a graduate seminar without exams, and a course composed from two publishers' packages. | CC-BY-4.0 |
| [educateos/](educateos/) | The twelve sample courses EducateOS publishes, from kindergarten science to United States history. They include 270 portable activities and 13 signed bundles. | Apache-2.0 (see [LICENSE.md](educateos/LICENSE.md)) |

Both directories are **package store directories** in the layout the `ocs` tool reads
(`<domain>/<name>/` per package, `<domain>/activities/` for activity exports,
`<domain>/publisher.json` for publisher keys, and `bundles/`). Try:

```sh
pnpm install && pnpm build
pnpm ocs validate examples/level-neutral examples/educateos
pnpm ocs inspect examples/level-neutral/example.org/watershed-science --store examples/level-neutral
pnpm ocs verify examples/educateos
```
