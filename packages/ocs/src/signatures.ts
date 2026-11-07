// Publisher signatures on OCS packages and activity exports (OCS 1.1 §15): Ed25519 envelopes over a
// statement's canonical JSON, in OCS's own signing contexts, so a signature made for any other
// message never verifies as a package or export publication, and the reverse. The contexts keep
// the names they were first published under (OCS 1.1 Appendix C).
import { z } from "zod";
import { OcsFailure } from "./errors.ts";
import { canonicalJson } from "./json.ts";
import { keyIdFor, PublisherKey, SignedEnvelope, type SigningIdentity, verifySignature } from "./keys.ts";
import type { ExportPublicationPolicy, PublicationPolicy } from "./library.ts";
import { UtcTimestamp } from "./vocab.ts";
import type { OcsPackage } from "./package.ts";
import { ActivityExportId, OcsPackageId, Sha256Digest } from "./schema.ts";
import { SemVer } from "./semver.ts";

/** The package publication signing context (OCS 1.1 §15.2). */
export const OCS_SIGNING_CONTEXT = "educateos-ocs/v1\0package-publication";
/**
 * OCS 1.1: the context of activity export publications. It differs from the package context, so a
 * package's signature never verifies as an export's, nor the reverse, even over the same digest.
 */
export const OCS_EXPORT_SIGNING_CONTEXT = "educateos-ocs/v1\0activity-export-publication";
/** The legacy package publication context, which verifiers still accept and producers never use (OCS 1.1 §15.2). */
export const LEGACY_OCS_SIGNING_CONTEXT = "schoolos-ocs/v1\0package-publication";

/** What a publisher signs: one version of one package, by its digest. */
export const PackagePublication = z.strictObject({
  packageId: OcsPackageId,
  version: SemVer,
  digest: Sha256Digest,
  publishedAt: UtcTimestamp,
});
/** A package publication statement. */
export type PackagePublication = z.infer<typeof PackagePublication>;

/** The publisher domain of a package: the part of its ID before the slash. */
export function publisherDomain(packageId: OcsPackageId): string {
  return packageId.slice(0, packageId.indexOf("/"));
}

/** A publisher's public keys, as a publisher may publish them (`publisher.json`, OCS 1.1 §15.1). */
export const PublisherKeys = z.strictObject({ domain: z.string().min(1).max(200), keys: z.array(PublisherKey).min(1).max(16) });
/** A publisher key document. */
export type PublisherKeys = z.infer<typeof PublisherKeys>;

/**
 * The publisher keys a destination approved (its trust configuration, OCS 1.1 §15.1). Each key list
 * is pinned to one publisher domain, so a key approved for one publisher can never sign another's
 * packages. Only the destination changes it. `localDomains` are the destination's own publishing
 * domains, whose packages it writes itself and does not need signed.
 */
export const PublisherTrust = z.strictObject({
  localDomains: z.array(z.string().min(1).max(200)).max(20),
  publishers: z.array(PublisherKeys).max(200),
});
/** A destination's approved publisher keys. */
export type PublisherTrust = z.infer<typeof PublisherTrust>;

/** The bytes a publication statement is signed as: the context, NUL, and the statement's canonical JSON. */
export const signedBytes = (publication: unknown, context: string = OCS_SIGNING_CONTEXT): Uint8Array => new TextEncoder().encode(`${context}\0${canonicalJson(publication)}`);

/** Signs a package's publication as its publisher. The statement is parsed first, so only a well-formed one is signed. */
export async function signPackagePublication(identity: SigningIdentity, publication: PackagePublication): Promise<SignedEnvelope> {
  const statement = PackagePublication.parse(publication);
  return {
    payload: JSON.parse(canonicalJson(statement)),
    signature: await identity.sign(signedBytes(statement)),
    keyId: identity.keyId,
  };
}

/** Why a publication was not accepted. `wrong-package` also covers a signature over another export. */
export type PublicationRefusal = "unsigned" | "unknown-publisher" | "bad-signature" | "wrong-package";

/** The approved, unretired key for `keyId` under a publisher domain, or undefined. */
async function approvedKey(trust: PublisherTrust, domain: string, keyId: string, now: Date) {
  const key = trust.publishers.find((publisher) => publisher.domain === domain)?.keys.find((candidate) => candidate.keyId === keyId);
  if (key === undefined || (key.retiresAt !== undefined && now.getTime() >= Date.parse(key.retiresAt))) return undefined;
  if ((await keyIdFor(key.publicKey)) !== key.keyId) return undefined;
  return key;
}

/**
 * Opens a publication signature: an envelope by a key the destination approved for `domain`, over a
 * payload signed in one of `contexts`. Returns the payload, or why it was refused.
 */
async function openSignature(
  domain: string,
  signature: unknown,
  trust: PublisherTrust,
  now: Date,
  contexts: readonly string[],
): Promise<{ ok: true; payload: unknown } | { ok: false; reason: PublicationRefusal }> {
  if (signature === undefined) return { ok: false, reason: "unsigned" };
  const envelope = SignedEnvelope.safeParse(signature);
  if (!envelope.success) return { ok: false, reason: "bad-signature" };
  const key = await approvedKey(trust, domain, envelope.data.keyId, now);
  if (key === undefined) return { ok: false, reason: "unknown-publisher" };
  for (const context of contexts) {
    let bytes: Uint8Array;
    try {
      bytes = signedBytes(envelope.data.payload, context);
    } catch {
      return { ok: false, reason: "bad-signature" };
    }
    if (await verifySignature(key.publicKey, envelope.data.signature, bytes)) return { ok: true, payload: envelope.data.payload };
  }
  return { ok: false, reason: "bad-signature" };
}

/**
 * Checks that `pkg` may enter the destination's library: a package from one of the destination's own
 * domains needs no signature; any other needs one, by a key the destination approved for that
 * package's publisher domain and has not retired by `now`, over exactly this package's ID, version
 * and digest. Nothing carried with the signature, such as a key, is trusted.
 */
export async function checkPublication(
  pkg: Pick<OcsPackage, "manifest" | "digest">,
  signature: unknown,
  trust: PublisherTrust,
  now: Date,
): Promise<{ ok: true; signed: boolean } | { ok: false; reason: PublicationRefusal }> {
  const domain = publisherDomain(pkg.manifest.id);
  if (trust.localDomains.includes(domain)) return { ok: true, signed: false };
  const opened = await openSignature(domain, signature, trust, now, [OCS_SIGNING_CONTEXT, LEGACY_OCS_SIGNING_CONTEXT]);
  if (!opened.ok) return opened;
  const statement = PackagePublication.safeParse(opened.payload);
  if (!statement.success) return { ok: false, reason: "bad-signature" };
  const { packageId, version, digest } = statement.data;
  if (packageId !== pkg.manifest.id || version !== pkg.manifest.version || digest !== pkg.digest) return { ok: false, reason: "wrong-package" };
  return { ok: true, signed: true };
}

/**
 * {@link checkPublication}, throwing.
 *
 * @throws OcsFailure `unauthenticated` naming the refusal.
 */
export async function assertPublication(pkg: Pick<OcsPackage, "manifest" | "digest">, signature: unknown, trust: PublisherTrust, now: Date): Promise<boolean> {
  const result = await checkPublication(pkg, signature, trust, now);
  if (!result.ok) throw new OcsFailure("unauthenticated", `the package's publisher signature was not accepted (${result.reason})`);
  return result.signed;
}

/**
 * The library's {@link PublicationPolicy} for a destination: {@link assertPublication} against its
 * approved publisher keys, at the time `now` gives.
 */
export function publisherPolicy(trust: PublisherTrust, now: () => Date = () => new Date()): PublicationPolicy {
  return async (pkg, signature) => ({ signed: await assertPublication(pkg, signature, trust, now()) });
}

/** What a publisher signs for a portable activity (OCS 1.1): one version of one export, by its digest. */
export const ActivityExportPublication = z.strictObject({
  exportId: ActivityExportId,
  version: SemVer,
  digest: Sha256Digest,
  publishedAt: UtcTimestamp,
});
/** An activity export publication statement. */
export type ActivityExportPublication = z.infer<typeof ActivityExportPublication>;

/**
 * Signs an activity export's publication as its publisher, in the export signing context. The
 * statement is parsed first, so only a well-formed one is signed.
 */
export async function signActivityExportPublication(identity: SigningIdentity, publication: ActivityExportPublication): Promise<SignedEnvelope> {
  const statement = ActivityExportPublication.parse(publication);
  return {
    payload: JSON.parse(canonicalJson(statement)),
    signature: await identity.sign(signedBytes(statement, OCS_EXPORT_SIGNING_CONTEXT)),
    keyId: identity.keyId,
  };
}

/**
 * {@link checkPublication} for an activity export: the same publisher keys and the same rules,
 * over exactly this export's ID, version and digest, signed in the export context.
 */
export async function checkExportPublication(
  exported: { id: string; version: string; digest: string },
  signature: unknown,
  trust: PublisherTrust,
  now: Date,
): Promise<{ ok: true; signed: boolean } | { ok: false; reason: PublicationRefusal }> {
  const domain = publisherDomain(exported.id);
  if (trust.localDomains.includes(domain)) return { ok: true, signed: false };
  const opened = await openSignature(domain, signature, trust, now, [OCS_EXPORT_SIGNING_CONTEXT]);
  if (!opened.ok) return opened;
  const statement = ActivityExportPublication.safeParse(opened.payload);
  if (!statement.success) return { ok: false, reason: "bad-signature" };
  const { exportId, version, digest } = statement.data;
  if (exportId !== exported.id || version !== exported.version || digest !== exported.digest) return { ok: false, reason: "wrong-package" };
  return { ok: true, signed: true };
}

/**
 * {@link checkExportPublication}, throwing.
 *
 * @throws OcsFailure `unauthenticated` naming the refusal.
 */
export async function assertExportPublication(exported: { id: string; version: string; digest: string }, signature: unknown, trust: PublisherTrust, now: Date): Promise<boolean> {
  const result = await checkExportPublication(exported, signature, trust, now);
  if (!result.ok) throw new OcsFailure("unauthenticated", `the shared activity's publisher signature was not accepted (${result.reason})`);
  return result.signed;
}

/**
 * The library's {@link ExportPublicationPolicy} for a destination: {@link assertExportPublication}
 * against the same approved publisher keys as {@link publisherPolicy}.
 */
export function publisherExportPolicy(trust: PublisherTrust, now: () => Date = () => new Date()): ExportPublicationPolicy {
  return async (parsed, signature) => ({ signed: await assertExportPublication({ id: parsed.export.id, version: parsed.export.version, digest: parsed.digest }, signature, trust, now()) });
}
