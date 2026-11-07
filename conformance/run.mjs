#!/usr/bin/env node
// The OCS conformance runner. It runs every case in conformance/cases against an implementation's
// adapter: a command that reads one JSON request on stdin and writes one JSON response on stdout
// (see conformance/README.md). Node.js 20+, no dependencies.
//
//   node conformance/run.mjs [--adapter "<command>"] [--filter <text>] [--json]
//
// The default adapter is the reference implementation's: `node packages/ocs/dist/cli.js conformance-adapter`.
// SPDX-License-Identifier: Apache-2.0
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const HERE = dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({
  options: {
    adapter: { type: "string", default: `node ${JSON.stringify(join(HERE, "../packages/ocs/dist/cli.js"))} conformance-adapter` },
    filter: { type: "string" },
    json: { type: "boolean", default: false },
    jobs: { type: "string", default: "8" },
  },
});

const index = JSON.parse(readFileSync(join(HERE, "cases/index.json"), "utf8"));
const cases = index.cases.filter((c) => values.filter === undefined || c.id.includes(values.filter));

/** Runs the adapter on one request. */
function ask(request) {
  return new Promise((done, fail) => {
    const child = spawn(values.adapter, { shell: true, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("error", fail);
    child.on("close", (code) => {
      if (code !== 0) return fail(new Error(`adapter exited with ${code}: ${err.trim()}`));
      try {
        done(JSON.parse(out));
      } catch {
        fail(new Error(`adapter wrote invalid JSON: ${out.slice(0, 200)}`));
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

/** JSON with sorted keys, for comparing outlines structurally. */
const canonical = (value) =>
  JSON.stringify(value, (_k, v) => (v !== null && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v));

/** Compares a response with a case's expectation; returns the differences. */
async function check(c, caseDir, expect, request) {
  const actual = await ask(request);
  const diffs = [];
  const same = (key, want) => {
    if (canonical(actual[key]) !== canonical(want)) diffs.push(`${key}: expected ${canonical(want)}, got ${canonical(actual[key])}`);
  };
  switch (c.kind) {
    case "package":
    case "export":
      same("valid", expect.valid);
      if (expect.valid) same("digest", expect.digest);
      else same("problem", expect.problem);
      break;
    case "resolve":
      if (expect.lock !== undefined) {
        const want = readFileSync(join(caseDir, expect.lock), "utf8");
        if (actual.lock !== want) diffs.push(`lock: not byte-identical to ${expect.lock}${actual.problem === undefined ? "" : ` (got problem ${actual.problem})`}`);
        // Determinism: the same inputs again give the same bytes.
        const again = await ask(request);
        if (again.lock !== actual.lock) diffs.push("lock: a second run gave different bytes");
      } else same("problem", expect.problem);
      break;
    case "compose":
      if (expect.outline !== undefined) {
        const want = JSON.parse(readFileSync(join(caseDir, expect.outline), "utf8"));
        if (canonical(actual.outline) !== canonical(want)) diffs.push(`outline: differs from ${expect.outline}${actual.problem === undefined ? "" : ` (got problem ${actual.problem})`}`);
      } else same("problem", expect.problem);
      break;
    case "bundle":
      same("accepted", expect.accepted);
      if (!expect.accepted) same("reason", expect.reason);
      break;
    case "publication":
      same("ok", expect.ok);
      if (expect.ok) same("signed", expect.signed);
      else same("reason", expect.reason);
      break;
    default:
      diffs.push(`unknown case kind ${c.kind}`);
  }
  return diffs;
}

const results = new Array(cases.length);
let next = 0;
async function worker() {
  while (next < cases.length) {
    const at = next++;
    const c = cases[at];
    const caseDir = resolve(HERE, "cases", c.id);
    const spec = JSON.parse(readFileSync(join(caseDir, "case.json"), "utf8"));
    try {
      const diffs = await check(spec, caseDir, spec.expect, { kind: spec.kind, caseDir, input: spec.input });
      results[at] = { id: c.id, kind: spec.kind, pass: diffs.length === 0, diffs };
    } catch (error) {
      results[at] = { id: c.id, kind: spec.kind, pass: false, diffs: [String(error.message ?? error)] };
    }
  }
}
await Promise.all(Array.from({ length: Math.max(1, Number(values.jobs)) }, worker));

const failed = results.filter((r) => !r.pass);
const byKind = {};
for (const r of results) {
  byKind[r.kind] ??= { pass: 0, fail: 0 };
  byKind[r.kind][r.pass ? "pass" : "fail"]++;
}
if (values.json) {
  process.stdout.write(`${JSON.stringify({ suite: index.suite, version: index.version, total: results.length, passed: results.length - failed.length, byKind, results }, null, 2)}\n`);
} else {
  for (const r of results) {
    if (!r.pass) process.stdout.write(`FAIL ${r.id}\n${r.diffs.map((d) => `       ${d}`).join("\n")}\n`);
  }
  for (const [kind, n] of Object.entries(byKind)) process.stdout.write(`${kind.padEnd(12)} ${n.pass} passed${n.fail === 0 ? "" : `, ${n.fail} failed`}\n`);
  process.stdout.write(`${index.suite} ${index.version}: ${results.length - failed.length}/${results.length} cases passed\n`);
}
process.exitCode = failed.length === 0 ? 0 : 1;
