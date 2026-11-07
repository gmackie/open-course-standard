import { type ActivityExportSource, type ParsedActivityExport, type PublishedActivityExport, readActivityExport } from "./activity-export.ts";
import { OcsFailure } from "./errors.ts";
import { type OcsFiles, type OcsPackage, readPackage } from "./package.ts";
import type { PackageSource, PublishedPackage } from "./resolver.ts";
import type { OcsPackageId } from "./schema.ts";

/**
 * Decides whether a package may enter a library, and whether it entered signed; throws to refuse
 * it. `publisherPolicy` checks publisher signatures against a destination's approved keys.
 */
export type PublicationPolicy = (pkg: OcsPackage, signature: unknown) => Promise<{ signed: boolean }>;

/** {@link PublicationPolicy} for activity exports. `publisherExportPolicy` checks their signatures. */
export type ExportPublicationPolicy = (exported: ParsedActivityExport, signature: unknown) => Promise<{ signed: boolean }>;

/** Options for {@link InMemoryPackageLibrary}. */
export interface LibraryOptions {
  /** Checks every package publication. Without one, every valid package is accepted. */
  policy?: PublicationPolicy | undefined;
  /** Checks every export publication. Without one, every valid export is accepted. */
  exportPolicy?: ExportPublicationPolicy | undefined;
}

/**
 * An in-memory {@link PackageSource} and {@link ActivityExportSource} that also accepts
 * publications: the reference behavior for a package store, and what tests use. A
 * published version, of a package or an export, is immutable: publishing the same version again
 * succeeds only with identical content.
 */
export class InMemoryPackageLibrary implements PackageSource, ActivityExportSource {
  readonly #packages = new Map<OcsPackageId, Map<string, PublishedPackage>>();
  readonly #exports = new Map<string, Map<string, PublishedActivityExport>>();
  readonly #options: LibraryOptions;

  constructor(options: LibraryOptions = {}) {
    this.#options = options;
  }

  /**
   * Adds a package version after reading and checking it.
   *
   * @throws OcsError `invalid-package` for invalid files, whatever the publication policy throws, and OcsFailure `conflict` if the
   *   version was already published with different content.
   */
  async publish(files: OcsFiles, signature?: unknown): Promise<PublishedPackage> {
    const pkg = await readPackage(files);
    await this.#options.policy?.(pkg, signature);
    const versions = this.#packages.get(pkg.manifest.id) ?? new Map<string, PublishedPackage>();
    const existing = versions.get(pkg.manifest.version);
    if (existing !== undefined) {
      if (existing.digest === pkg.digest) return existing;
      throw new OcsFailure("conflict", `${pkg.manifest.id} ${pkg.manifest.version} is already published with different content; publish a new version instead`);
    }
    const published = { files: { ...files }, digest: pkg.digest };
    versions.set(pkg.manifest.version, published);
    this.#packages.set(pkg.manifest.id, versions);
    return published;
  }

  async listVersions(id: OcsPackageId): Promise<readonly string[]> {
    return [...(this.#packages.get(id)?.keys() ?? [])];
  }

  async getPackage(id: OcsPackageId, version: string): Promise<PublishedPackage | undefined> {
    const found = this.#packages.get(id)?.get(version);
    return found === undefined ? undefined : { files: { ...found.files }, digest: found.digest };
  }

  /**
   * Adds an activity export version (OCS 1.1) after reading and checking it.
   *
   * @throws OcsError `invalid-export` for an invalid file, and OcsFailure `conflict` if the
   *   version was already published with different content.
   */
  async publishExport(text: string, signature?: unknown): Promise<PublishedActivityExport> {
    const parsed = await readActivityExport(text);
    const { export: exported, digest } = parsed;
    await this.#options.exportPolicy?.(parsed, signature);
    const versions = this.#exports.get(exported.id) ?? new Map<string, PublishedActivityExport>();
    const existing = versions.get(exported.version);
    if (existing !== undefined) {
      if (existing.digest === digest) return { ...existing };
      throw new OcsFailure("conflict", `${exported.id} ${exported.version} is already published with different content; publish a new version instead`);
    }
    versions.set(exported.version, { text, digest });
    this.#exports.set(exported.id, versions);
    return { text, digest };
  }

  async listExportVersions(id: string): Promise<readonly string[]> {
    return [...(this.#exports.get(id)?.keys() ?? [])];
  }

  async getExport(id: string, version: string): Promise<PublishedActivityExport | undefined> {
    const found = this.#exports.get(id)?.get(version);
    return found === undefined ? undefined : { ...found };
  }
}
