// Ed25519 keys, key IDs and signature envelopes (OCS 1.1 §15.1, §15.2), on Web Crypto only.
import { z } from "zod";
import { fromBase64Url, sha256, toBase64Url } from "./json.ts";
import { UtcTimestamp } from "./vocab.ts";

const ED25519 = { name: "Ed25519" } as const;

/** Unpadded base64url text. */
export const Base64Url = z.string().regex(/^[A-Za-z0-9_-]*$/, "expected unpadded base64url");

/** A raw 32-byte Ed25519 public key, base64url-encoded (43 characters). */
export const Ed25519PublicKey = Base64Url.length(43);
/** An Ed25519 public key. */
export type Ed25519PublicKey = z.infer<typeof Ed25519PublicKey>;

/** `ed25519-` and the base64url SHA-256 of the raw public key, so a key ID can never name another key. */
export const KeyId = z.string().regex(/^ed25519-[A-Za-z0-9_-]{43}$/, "expected an Ed25519 key ID");
/** A key ID. */
export type KeyId = z.infer<typeof KeyId>;

/** A 64-byte Ed25519 signature, base64url-encoded (86 characters). */
export const Ed25519Signature = Base64Url.length(86);

/** An Ed25519 private key as a JWK. It carries the public key (`x`) too. */
export const Ed25519PrivateJwk = z.strictObject({
  kty: z.literal("OKP"),
  crv: z.literal("Ed25519"),
  x: Base64Url.length(43),
  d: Base64Url.length(43),
});
/** An Ed25519 private JWK. */
export type Ed25519PrivateJwk = z.infer<typeof Ed25519PrivateJwk>;

const ExportedJwk = z.object({ kty: z.string(), crv: z.string(), x: z.string(), d: z.string().optional() });

/**
 * A signed statement: the statement, the signature over its signed bytes, and the ID of the key
 * that made it. Verifiers look the key up themselves and never trust a key carried alongside.
 */
export const SignedEnvelope = z.strictObject({
  payload: z.json(),
  signature: Ed25519Signature,
  keyId: KeyId,
});
/** A signature envelope. */
export type SignedEnvelope = z.infer<typeof SignedEnvelope>;

/**
 * A publisher key a destination trusts. A key with `retiresAt` is trusted only before that
 * moment, which gives a rotation its overlap.
 */
export const PublisherKey = z.strictObject({
  keyId: KeyId,
  publicKey: Ed25519PublicKey,
  retiresAt: UtcTimestamp.optional(),
});
/** A publisher key. */
export type PublisherKey = z.infer<typeof PublisherKey>;

/** Derives the key ID of a public key. */
export async function keyIdFor(publicKey: Ed25519PublicKey): Promise<KeyId> {
  return `ed25519-${toBase64Url(await sha256(fromBase64Url(publicKey)))}`;
}

/** Verifies an Ed25519 signature. Returns false, never throws, for a malformed key or signature. */
export async function verifySignature(publicKey: string, signature: string, data: Uint8Array): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("raw", fromBase64Url(publicKey), ED25519, false, ["verify"]);
    return await crypto.subtle.verify(ED25519, key, fromBase64Url(signature), data as Uint8Array<ArrayBuffer>);
  } catch {
    return false;
  }
}

/**
 * An Ed25519 key pair held through Web Crypto: a publisher's signing identity. The private key
 * leaves the object only through {@link SigningIdentity.exportJwk}.
 */
export class SigningIdentity {
  /** The ID of {@link SigningIdentity.publicKey}. */
  readonly keyId: KeyId;
  /** The public key, for destinations to approve. */
  readonly publicKey: Ed25519PublicKey;
  readonly #privateKey: CryptoKey;

  private constructor(keyId: KeyId, publicKey: Ed25519PublicKey, privateKey: CryptoKey) {
    this.keyId = keyId;
    this.publicKey = publicKey;
    this.#privateKey = privateKey;
  }

  /** Generates a new identity. The private key is extractable only so it can be saved. */
  static async generate(): Promise<SigningIdentity> {
    const pair = (await crypto.subtle.generateKey(ED25519, true, ["sign", "verify"])) as CryptoKeyPair;
    const { x } = ExportedJwk.parse(await crypto.subtle.exportKey("jwk", pair.publicKey));
    const publicKey = Ed25519PublicKey.parse(x);
    return new SigningIdentity(await keyIdFor(publicKey), publicKey, pair.privateKey);
  }

  /** Restores an identity saved with {@link SigningIdentity.exportJwk}. */
  static async fromJwk(input: Ed25519PrivateJwk): Promise<SigningIdentity> {
    const jwk = Ed25519PrivateJwk.parse(input);
    const privateKey = await crypto.subtle.importKey("jwk", jwk, ED25519, true, ["sign"]);
    const publicKey = Ed25519PublicKey.parse(jwk.x);
    return new SigningIdentity(await keyIdFor(publicKey), publicKey, privateKey);
  }

  /** Exports the private key as a JWK, which also carries the public key. Keep it secret. */
  async exportJwk(): Promise<Ed25519PrivateJwk> {
    return Ed25519PrivateJwk.parse(ExportedJwk.parse(await crypto.subtle.exportKey("jwk", this.#privateKey)));
  }

  /** Signs bytes, returning the base64url signature. */
  async sign(data: Uint8Array): Promise<string> {
    return toBase64Url(new Uint8Array(await crypto.subtle.sign(ED25519, this.#privateKey, data as Uint8Array<ArrayBuffer>)));
  }
}
