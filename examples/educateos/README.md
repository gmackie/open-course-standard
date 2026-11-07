# EducateOS sample courses

The twelve sample courses that [EducateOS](https://github.com/gmackie/educate-os) publishes for
every district, as OCS 1.1 packages:

| Course | Grades |
| --- | --- |
| `educateos.io/kindergarten-science-weather-watchers` | K |
| `educateos.io/grade-1-mathematics` | 1 |
| `educateos.io/grade-1-reading-foundations` | 1 |
| `educateos.io/grade-4-english-language-arts` | 4 |
| `educateos.io/grade-4-mathematics` | 4 |
| `educateos.io/grade-5-science` | 5 |
| `educateos.io/mathematics-7` | 7 |
| `educateos.io/world-history-7` | 7 |
| `educateos.io/english-8` | 8 |
| `educateos.io/english-9` (1.0.1) | 9-12 |
| `educateos.io/biology-1` | 9-12 |
| `educateos.io/united-states-history` | 9-12 |

- `educateos.io/activities/` holds their 270 portable activity exports.
- `educateos.io/publisher.json` holds the publisher's public key.
- `bundles/` holds the 13 bundles, every package and export signed with that key. There are two
  English 9 versions, 1.0.0 and 1.0.1.

`pnpm ocs validate examples/educateos` checks every package, lockfile, export, digest and
signature. CI runs it on every change.

**Source.** Copied unchanged from `curriculum/` in
[gmackie/educate-os](https://github.com/gmackie/educate-os/tree/54c29d9523aa97c6bf40da0605f7edf5256c362c/curriculum)
at commit `54c29d9523aa97c6bf40da0605f7edf5256c362c` (the courses last changed in `2b4155a`,
2026-11-04). EducateOS remains their publisher. Changes belong upstream, and new versions should
be copied here when they are published. See [LICENSE.md](LICENSE.md).
