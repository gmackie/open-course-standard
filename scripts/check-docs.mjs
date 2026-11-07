// Checks the repository's Markdown: every relative link and image must point at a file or
// directory that exists, and every license file the top-level LICENSE names must be present.
// Run with `pnpm check:docs`. SPDX-License-Identifier: Apache-2.0
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".git", "dist", "coverage"]);

function* markdownFiles(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* markdownFiles(path);
    else if (name.endsWith(".md")) yield path;
  }
}

const problems = [];
const LINK = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
for (const file of markdownFiles(root)) {
  // Links inside fenced code blocks are examples, not links.
  const text = readFileSync(file, "utf8").replace(/^(```|~~~)[\s\S]*?^\1/gm, "");
  for (const match of text.matchAll(LINK)) {
    const target = match[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
    const path = decodeURIComponent(target.split("#")[0]);
    if (path === "") continue;
    if (!existsSync(resolve(dirname(file), path))) problems.push(`${relative(root, file)}: broken link to ${target}`);
  }
}

for (const license of ["LICENSE", "LICENSES/Apache-2.0.txt", "LICENSES/CC-BY-4.0.txt"]) {
  if (!existsSync(join(root, license))) problems.push(`missing ${license}`);
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("docs: every relative link resolves and every license file is present");
