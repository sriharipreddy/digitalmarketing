import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertValidKey, type StorageDriver, type UploadOptions, type StorageObject } from '../driver.js';

interface LocalDriverOpts {
  basePath: string;
  publicUrlBase: string;
  publicPathPrefix: string;
  signingSecret: string;
}

export class LocalDriver implements StorageDriver {
  private basePath: string;
  private publicUrlBase: string;
  private publicPathPrefix: string;
  private signingSecret: string;

  constructor(opts: LocalDriverOpts) {
    this.basePath = path.resolve(opts.basePath);
    this.publicUrlBase = opts.publicUrlBase;
    this.publicPathPrefix = opts.publicPathPrefix;
    this.signingSecret = opts.signingSecret;
  }

  private resolveFilePath(key: string): string {
    assertValidKey(key);
    return path.join(this.basePath, key);
  }

  async upload(buffer: Buffer, key: string, opts: UploadOptions = {}): Promise<string> {
    const filePath = this.resolveFilePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    if (opts.contentType || opts.cacheControl || opts.metadata) {
      await fs.writeFile(
        filePath + '.meta.json',
        JSON.stringify({
          contentType: opts.contentType,
          cacheControl: opts.cacheControl,
          metadata: opts.metadata,
        }),
      );
    }
    return key;
  }

  async download(key: string): Promise<Buffer> {
    return fs.readFile(this.resolveFilePath(key));
  }

  async delete(key: string): Promise<void> {
    const fp = this.resolveFilePath(key);
    try {
      await fs.unlink(fp);
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }
    try {
      await fs.unlink(fp + '.meta.json');
    } catch {
      /* ignore */
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    const dir = this.resolveFilePath(prefix);
    await fs.rm(dir, { recursive: true, force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolveFilePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async getSignedDownloadUrl(key: string, opts: { expiresIn: number }): Promise<string> {
    if (!this.signingSecret) {
      throw new Error('LocalDriver requires signingSecret to issue signed URLs');
    }
    const expires = Math.floor(Date.now() / 1000) + opts.expiresIn;
    const signature = crypto
      .createHmac('sha256', this.signingSecret)
      .update(`${key}:${expires}`)
      .digest('hex');
    return `${this.publicUrlBase}${this.publicPathPrefix}/${encodeURIComponent(key)}?expires=${expires}&sig=${signature}`;
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrlBase}${this.publicPathPrefix}/${encodeURIComponent(key)}`;
  }

  async list(prefix: string, opts: { limit?: number } = {}): Promise<StorageObject[]> {
    const dir = this.resolveFilePath(prefix);
    const out: StorageObject[] = [];
    const walk = async (current: string): Promise<void> => {
      let entries: import('fs').Dirent[];
      try {
        entries = await fs.readdir(current, { withFileTypes: true });
      } catch (e: any) {
        if (e.code === 'ENOENT') return;
        throw e;
      }
      for (const entry of entries) {
        if (opts.limit && out.length >= opts.limit) return;
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) await walk(full);
        else if (entry.isFile() && !entry.name.endsWith('.meta.json')) {
          const stat = await fs.stat(full);
          out.push({
            key: path.relative(this.basePath, full),
            size: stat.size,
            lastModified: stat.mtime,
          });
        }
      }
    };
    await walk(dir);
    return out;
  }

  async copy(sourceKey: string, destKey: string): Promise<void> {
    const src = this.resolveFilePath(sourceKey);
    const dst = this.resolveFilePath(destKey);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
  }

  async stat(key: string): Promise<{ size: number; lastModified: Date; contentType?: string }> {
    const fp = this.resolveFilePath(key);
    const stat = await fs.stat(fp);
    let contentType: string | undefined;
    try {
      const meta = JSON.parse(await fs.readFile(fp + '.meta.json', 'utf8'));
      contentType = meta.contentType;
    } catch {
      /* no meta sidecar */
    }
    return { size: stat.size, lastModified: stat.mtime, contentType };
  }
}
