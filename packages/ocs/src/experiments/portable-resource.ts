// Experimental detached rich-media profile. NOT an OCS 1.1 resource reference.
import { z } from "zod";
import { OcsFailure } from "../errors.ts";
import { sha256, toHex } from "../json.ts";
import { OcsPackageId, PlainText, Sha256Digest } from "../schema.ts";
import { SemVer } from "../semver.ts";

const SafeHttpsUrl = z.url().refine((uri) => uri.startsWith("https://"), "only HTTPS locators are allowed");
export const PortableResourceManifestV0 = z.strictObject({
  profile: z.literal("ocs-portable-resource/0.1"),
  id: OcsPackageId,
  version: SemVer,
  digest: Sha256Digest,
  /** Bound verification size; the actual byte fetch is a destination-controlled operation. */
  byteLength: z.number().int().min(1).max(100 * 1024 * 1024),
  mediaType: z.enum([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg", "image/png", "text/plain", "audio/mpeg", "video/mp4",
  ]),
  title: PlainText(200),
  attribution: PlainText(1000),
  license: z.strictObject({ identifier: PlainText(100), uri: SafeHttpsUrl.optional() }),
  visibility: z.enum(["public", "restricted"]),
  locator: SafeHttpsUrl.optional(),
  altText: PlainText(2000).optional(),
  transcriptResourceId: OcsPackageId.optional(),
});
export type PortableResourceManifestV0 = z.infer<typeof PortableResourceManifestV0>;

/**
 * Check exact bytes and claimed metadata. No network access, MIME execution or auto-import.
 * This DOES NOT prove media safety, license ownership, accessibility, or publisher identity.
 * Before using a resource, destinations must authenticate the publisher, review rights,
 * authorize the use, safely inspect the media and store it under local authority.
 */
export async function verifyPortableResourceBytes(
  input: unknown,
  bytes: Uint8Array,
): Promise<PortableResourceManifestV0> {
  const result = PortableResourceManifestV0.safeParse(input);
  if (!result.success) throw new OcsFailure("validation-failed", "invalid portable resource: " + result.error.issues[0]?.message);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== result.data.byteLength) {
    throw new OcsFailure("validation-failed", "resource byte length does not match the manifest");
  }
  const digest = "sha256:" + toHex(await sha256(bytes));
  if (digest !== result.data.digest) throw new OcsFailure("validation-failed", "resource digest mismatch");
  return result.data;
}
