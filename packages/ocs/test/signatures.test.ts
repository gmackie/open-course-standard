import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  checkExportPublication,
  checkPublication,
  type Ed25519PublicKey,
  keyIdFor,
  publisherPolicy,
  type PublisherTrust,
  readPackage,
  signActivityExportPublication,
  SigningIdentity,
  signPackagePublication,
} from "../src/index.ts";
import { IDS, packageFiles, resource, unit } from "./helpers.ts";

const NOW = new Date("2026-10-21T09:00:00Z");

const approved = async (publicKey: Ed25519PublicKey) => [{ keyId: await keyIdFor(publicKey), publicKey }];

const bioPackage = (title = "Membranes") => readPackage(packageFiles({
  manifest: { id: IDS.bio, version: "2.0.0", outline: [{ kind: "unit", unit: "membranes" }] },
  units: [unit("membranes", [{ kind: "resource", ref: "diagram" }], title)],
  resources: [resource("diagram", "link")],
}));

async function setup() {
  const publisher = await SigningIdentity.generate();
  const other = await SigningIdentity.generate();
  const pkg = await bioPackage();
  const statement = { packageId: pkg.manifest.id, version: pkg.manifest.version, digest: pkg.digest, publishedAt: "2026-10-20T09:00:00Z" };
  const trust: PublisherTrust = {
    localDomains: ["northfield.example"],
    publishers: [
      { domain: "openbio.example", keys: await approved(publisher.publicKey) },
      { domain: "labsafe.example", keys: await approved(other.publicKey) },
    ],
  };
  return { publisher, other, pkg, statement, trust };
}

describe("publisher signatures", () => {
  it("accept a package signed by a key the destination approved for its publisher", async () => {
    const { publisher, pkg, statement, trust } = await setup();
    expect(await checkPublication(pkg, await signPackagePublication(publisher, statement), trust, NOW)).toStrictEqual({ ok: true, signed: true });
  });

  it("accept a package publication signed in the legacy context", async () => {
    const { publisher, pkg, statement, trust } = await setup();
    const bytes = new TextEncoder().encode(`schoolos-ocs/v1\0package-publication\0${canonicalJson(statement)}`);
    const legacy = { payload: JSON.parse(canonicalJson(statement)), signature: await publisher.sign(bytes), keyId: publisher.keyId };
    expect(await checkPublication(pkg, legacy, trust, NOW)).toStrictEqual({ ok: true, signed: true });
    expect(await checkPublication(pkg, { ...legacy, payload: { ...legacy.payload, version: "2.0.1" } }, trust, NOW)).toStrictEqual({ ok: false, reason: "bad-signature" });
  });

  it("refuse an unsigned package from outside the destination, and need none from its own domains", async () => {
    const { pkg, trust } = await setup();
    expect(await checkPublication(pkg, undefined, trust, NOW)).toStrictEqual({ ok: false, reason: "unsigned" });
    expect(await checkPublication(pkg, undefined, { ...trust, localDomains: ["openbio.example"] }, NOW)).toStrictEqual({ ok: true, signed: false });
  });

  it("refuse a key approved only for another publisher, or not approved at all", async () => {
    const { other, pkg, statement, trust } = await setup();
    expect(await checkPublication(pkg, await signPackagePublication(other, statement), trust, NOW)).toStrictEqual({ ok: false, reason: "unknown-publisher" });
    const stranger = await SigningIdentity.generate();
    expect(await checkPublication(pkg, await signPackagePublication(stranger, statement), trust, NOW)).toStrictEqual({ ok: false, reason: "unknown-publisher" });
  });

  it("refuse a signature over other content, another version, or a tampered statement", async () => {
    const { publisher, pkg, statement, trust } = await setup();
    const changed = await bioPackage("Membranes, edited");
    expect(await checkPublication(changed, await signPackagePublication(publisher, statement), trust, NOW)).toStrictEqual({ ok: false, reason: "wrong-package" });
    const envelope = await signPackagePublication(publisher, statement);
    const tampered = { ...envelope, payload: { ...(envelope.payload as object), digest: changed.digest } };
    expect(await checkPublication(changed, tampered, trust, NOW)).toStrictEqual({ ok: false, reason: "bad-signature" });
    expect(await checkPublication(pkg, { not: "an envelope" }, trust, NOW)).toStrictEqual({ ok: false, reason: "bad-signature" });
  });

  it("refuse a signature made in another signing context with an approved key", async () => {
    const { publisher, pkg, statement, trust } = await setup();
    // The same statement, signed as another protocol's message would be (EducateOS fleet and release contexts).
    const signedIn = async (context: string) => ({
      payload: JSON.parse(canonicalJson(statement)),
      signature: await publisher.sign(new TextEncoder().encode(`${context}\0${canonicalJson(statement)}`)),
      keyId: publisher.keyId,
    });
    for (const context of ["educateos-fleet/v1\0heartbeat", "educateos-releases/v1\0release-manifest", "educateos-ocs/v1\0activity-export-publication"]) {
      expect(await checkPublication(pkg, await signedIn(context), trust, NOW)).toStrictEqual({ ok: false, reason: "bad-signature" });
    }
  });

  it("never accept a package signature as an export's, nor the reverse", async () => {
    const { publisher, pkg, trust } = await setup();
    const exported = { id: "openbio.example/cell-models", version: "1.0.0", digest: pkg.digest };
    const publishedAt = "2026-10-20T09:00:00Z";
    const asExport = await signActivityExportPublication(publisher, { exportId: exported.id, version: exported.version, digest: exported.digest, publishedAt });
    expect(await checkExportPublication(exported, asExport, trust, NOW)).toStrictEqual({ ok: true, signed: true });
    const asPackage = await signPackagePublication(publisher, { packageId: exported.id, version: exported.version, digest: exported.digest, publishedAt });
    expect(await checkExportPublication(exported, asPackage, trust, NOW)).toStrictEqual({ ok: false, reason: "bad-signature" });
    expect(await checkPublication(pkg, asExport, trust, NOW)).toStrictEqual({ ok: false, reason: "bad-signature" });
  });

  it("round-trip a signing identity through its private JWK", async () => {
    const { publisher, pkg, statement, trust } = await setup();
    const restored = await SigningIdentity.fromJwk(await publisher.exportJwk());
    expect(restored.keyId).toBe(publisher.keyId);
    expect(await checkPublication(pkg, await signPackagePublication(restored, statement), trust, NOW)).toStrictEqual({ ok: true, signed: true });
  });

  it("refuse a key the destination has retired", async () => {
    const { publisher, pkg, statement, trust } = await setup();
    const keys = trust.publishers[0]!.keys.map((key) => ({ ...key, retiresAt: "2026-10-01T00:00:00Z" }));
    const retired = { ...trust, publishers: [{ domain: "openbio.example", keys }] };
    expect(await checkPublication(pkg, await signPackagePublication(publisher, statement), retired, NOW)).toStrictEqual({ ok: false, reason: "unknown-publisher" });
  });

  it("make the library's publication policy, which refuses as unauthenticated", async () => {
    const { publisher, pkg, statement, trust } = await setup();
    const policy = publisherPolicy(trust, () => NOW);
    expect(await policy(pkg, await signPackagePublication(publisher, statement))).toStrictEqual({ signed: true });
    await expect(policy(pkg, undefined)).rejects.toMatchObject({ code: "unauthenticated", message: expect.stringContaining("unsigned") });
  });
});
