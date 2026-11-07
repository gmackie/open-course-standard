// The library (everything but the CLI and `node/`) uses web-standard APIs only, so it runs in
// browsers as well as Node.js 20+.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "../src");

describe("browser portability", () => {
  it("keeps Node.js modules out of the library", () => {
    const files = readdirSync(SRC).filter((name) => name.endsWith(".ts") && name !== "cli.ts");
    expect(files.length).toBeGreaterThan(10);
    for (const name of files) {
      const text = readFileSync(join(SRC, name), "utf8");
      expect(text, name).not.toMatch(/from "node:|require\(|\bprocess\.|\bBuffer\.|from "\.\/node\//);
    }
  });
});
