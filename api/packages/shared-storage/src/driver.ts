export interface UploadOptions {
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
}

export interface StorageDriver {
  upload(buffer: Buffer, key: string, opts?: UploadOptions): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getSignedDownloadUrl(key: string, opts: { expiresIn: number }): Promise<string>;
  getPublicUrl(key: string): string;
  list(prefix: string, opts?: { limit?: number }): Promise<StorageObject[]>;
  copy(sourceKey: string, destKey: string): Promise<void>;
  stat(key: string): Promise<{ size: number; lastModified: Date; contentType?: string }>;
}

/**
 * Enforces tenant-scoped keys. Every file path MUST start with
 * `workspace/<id>/...` so per-workspace deletion (cancellation + RTBF)
 * is a single deletePrefix() call.
 */
export function assertValidKey(key: string): void {
  if (key.includes('..')) {
    throw new Error('Invalid storage key: path traversal forbidden');
  }
  if (!key.startsWith('workspace/') && !key.startsWith('system/')) {
    throw new Error(
      `Invalid storage key "${key}": must start with "workspace/<id>/" or "system/" prefix`,
    );
  }
}
