import { describe, expect, it } from "vitest";
import { sha256, toHex } from "../src/json.ts";
import { verifyPortableResourceBytes } from "../src/experiments/portable-resource.ts";

const bytes = new TextEncoder().encode("Fictional classroom handout for testing");
const manifest = async () => ({
  profile: "ocs-portable-resource/0.1",
  id: "example.edu/intro-biology-handout",
  version: "1.0.0",
  digest: "sha256:" + toHex(await sha256(bytes)),
  byteLength: bytes.byteLength,
  mediaType: "application/pdf",
  title: "Biology handout",
  attribution: "Example Education, fictional content",
  license: { identifier: "CC-BY-4.0", uri: "https://creativecommons.org/licenses/by/4.0/" },
  visibility: "public",
});

describe("experimental detached portable resource metadata", () => {
  it("verifies exact bytes and digest without fetching, executing or installing them", async () => {
    const data = await manifest();
    await expect(verifyPortableResourceBytes(data, bytes)).resolves.toMatchObject({ id: data.id, digest: data.digest });
    await expect(verifyPortableResourceBytes(data, new TextEncoder().encode("altered"))).rejects.toThrow(/byte length/);
    const tampered = bytes.slice();
    tampered[0] = 0x00;
    await expect(verifyPortableResourceBytes(data, tampered)).rejects.toThrow(/digest mismatch/);
  });

  it("rejects active media types, non-HTTPS locators and undeclared fields", async () => {
    const data = await manifest();
    await expect(verifyPortableResourceBytes({ ...data, mediaType: "text/html" }, bytes)).rejects.toThrow(/invalid portable resource/);
    await expect(verifyPortableResourceBytes({ ...data, locator: "http://localhost/private" }, bytes)).rejects.toThrow(/invalid portable resource/);
    await expect(verifyPortableResourceBytes({ ...data, executable: true }, bytes)).rejects.toThrow(/invalid portable resource/);
  });
});
