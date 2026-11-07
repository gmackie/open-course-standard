// Canonical JSON, the formatted form and digests (OCS 1.1 §3.3, §3.4). Web-standard APIs only, so
// the library runs unchanged in Node.js 20+ and browsers.

/**
 * JSON with every object's members sorted by name (compared as UTF-16 code units), so equal values
 * serialize identically whatever their member order. For parsed JSON this is RFC 8785 (JCS).
 * Members whose value is `undefined` are left out, as `JSON.stringify` leaves them out.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v);
}

/** JSON with sorted keys, indented by two spaces, with a final newline: the form OCS writes every file in. */
export function formatJson(value: unknown): string {
  return `${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`;
}

/** Lowercase hexadecimal of some bytes. */
export const toHex = (bytes: ArrayBuffer | Uint8Array): string =>
  Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");

/** SHA-256 of some bytes. */
export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>));
}

/** The `sha256:<hex>` digest of a value's canonical JSON. */
export async function contentDigest(value: unknown): Promise<string> {
  return `sha256:${toHex(await sha256(new TextEncoder().encode(canonicalJson(value))))}`;
}

/** Encodes bytes as unpadded base64url (RFC 4648 §5). */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** Decodes unpadded base64url. Throws on anything else. */
export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("expected unpadded base64url");
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (text.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
