// Reading OCS documents from the filesystem (Node.js only): a package directory, and a package store
// directory that serves packages and activity exports to the resolver. The store layout is a
// convention of this implementation, not part of the standard:
//
//   <store>/<domain>/publisher.json             optional publisher key document (OCS 1.1 §15.1)
//   <store>/<domain>/activities/<name>.json     activity export <domain>/<name> (OCS 1.1 §14)
//   <store>/<domain>/<name>/ocs.json …          package <domain>/<name>, one version, or
//   <store>/<domain>/<name>/<version>/ocs.json  one directory per version
//   <store>/bundles/…                            bundles (OCS 1.1 §16), read by `ocs verify`
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { activityExportDigest, type ActivityExportSource, type PublishedActivityExport } from "../activity-export.ts";
import { type OcsFiles, packageDigest } from "../package.ts";
import type { PackageSource, PublishedPackage } from "../resolver.ts";
import { PublisherKeys, type PublisherTrust } from "../signatures.ts";

/** Files a directory listing ignores: operating-system clutter, never package content. */
export const IGNORED_FILES: ReadonlySet<string> = new Set([".DS_Store", "Thumbs.db"]);

const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const NAME = /^[a-z][a-z0-9-]{0,62}$/;
const VERSION = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;

const isDirectory = (path: string) => existsSync(path) && statSync(path).isDirectory();
const list = (dir: string) => readdirSync(dir).filter((name) => !IGNORED_FILES.has(name)).toSorted();

/**
 * Every file under a package directory, by package path (`/`-separated). Nothing is filtered but
 * {@link IGNORED_FILES}: anything else in the directory is part of what the reader checks, so a
 * stray script makes the package invalid, as it must (OCS 1.1 §5).
 */
export function readPackageDirectory(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (current: string) => {
    for (const name of list(current)) {
      const path = join(current, name);
      if (isDirectory(path)) walk(path);
      else files[relative(dir, path).split(sep).join("/")] = readFileSync(path, "utf8");
    }
  };
  walk(dir);
  return files;
}

/** Whether a directory holds a package (it has `ocs.json`). */
export const isPackageDirectory = (dir: string): boolean => existsSync(join(dir, "ocs.json"));

/** One package version found in a store directory. */
export interface StoredPackage {
  id: string;
  version: string;
  dir: string;
}

/** One activity export file found in a store directory. */
export interface StoredExport {
  id: string;
  path: string;
}

/**
 * A package store on disk, used as a {@link PackageSource} and {@link ActivityExportSource}. The
 * directory is its own publication record, so the "published" digest is the digest of what is on
 * disk; the resolver still checks every package's identity, locked digest and pins.
 */
export class DirectoryStore implements PackageSource, ActivityExportSource {
  readonly root: string;
  /** Package versions found, by package ID then version. */
  readonly packages = new Map<string, Map<string, StoredPackage>>();
  /** Export files found, by export ID. */
  readonly exports = new Map<string, StoredExport>();
  /** Publisher key documents found, by path. */
  readonly publisherFiles: string[] = [];
  /** Paths the store layout does not explain. */
  readonly unexpected: string[] = [];

  constructor(root: string) {
    this.root = root;
    for (const domain of isDirectory(root) ? list(root) : []) {
      const domainDir = join(root, domain);
      if (domain === "bundles" || !isDirectory(domainDir)) continue;
      if (!DOMAIN.test(domain)) {
        this.unexpected.push(domainDir);
        continue;
      }
      for (const name of list(domainDir)) {
        const path = join(domainDir, name);
        if (name === "publisher.json" && !isDirectory(path)) this.publisherFiles.push(path);
        else if (name === "activities" && isDirectory(path)) {
          for (const file of list(path)) {
            const match = /^([a-z][a-z0-9-]{0,62})\.json$/.exec(file);
            if (match === null) this.unexpected.push(join(path, file));
            else this.exports.set(`${domain}/${match[1]}`, { id: `${domain}/${match[1]}`, path: join(path, file) });
          }
        } else if (NAME.test(name) && isDirectory(path)) {
          if (isPackageDirectory(path)) this.#addPackage(`${domain}/${name}`, path);
          else {
            for (const version of list(path)) {
              const versionDir = join(path, version);
              if (VERSION.test(version) && isPackageDirectory(versionDir)) this.#addPackage(`${domain}/${name}`, versionDir, version);
              else this.unexpected.push(versionDir);
            }
          }
        } else this.unexpected.push(path);
      }
    }
  }

  #addPackage(id: string, dir: string, version?: string): void {
    let declared = version;
    if (declared === undefined) {
      try {
        const manifest = JSON.parse(readFileSync(join(dir, "ocs.json"), "utf8")) as { version?: unknown };
        declared = typeof manifest.version === "string" ? manifest.version : "0.0.0";
      } catch {
        declared = "0.0.0";
      }
    }
    const versions = this.packages.get(id) ?? new Map<string, StoredPackage>();
    versions.set(declared, { id, version: declared, dir });
    this.packages.set(id, versions);
  }

  /** Every package version in the store, sorted by ID and directory. */
  allPackages(): StoredPackage[] {
    return [...this.packages.values()].flatMap((versions) => [...versions.values()]).toSorted((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0));
  }

  async listVersions(id: string): Promise<readonly string[]> {
    return [...(this.packages.get(id)?.keys() ?? [])];
  }

  async getPackage(id: string, version: string): Promise<PublishedPackage | undefined> {
    const found = this.packages.get(id)?.get(version);
    if (found === undefined) return undefined;
    const files: OcsFiles = readPackageDirectory(found.dir);
    return { files, digest: await packageDigest(files) };
  }

  async listExportVersions(id: string): Promise<readonly string[]> {
    const found = this.exports.get(id);
    if (found === undefined) return [];
    try {
      const version = (JSON.parse(readFileSync(found.path, "utf8")) as { version?: unknown }).version;
      return typeof version === "string" ? [version] : [];
    } catch {
      return [];
    }
  }

  async getExport(id: string, version: string): Promise<PublishedActivityExport | undefined> {
    if (!(await this.listExportVersions(id)).includes(version)) return undefined;
    const text = readFileSync(this.exports.get(id)!.path, "utf8");
    return { text, digest: await activityExportDigest(text) };
  }

  /** The store's publisher key documents as a trust configuration with no local domains. */
  trust(): PublisherTrust {
    return { localDomains: [], publishers: this.publisherFiles.map((path) => PublisherKeys.parse(JSON.parse(readFileSync(path, "utf8")))) };
  }
}
