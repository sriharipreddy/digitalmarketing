import { S3Driver } from './drivers/s3.driver.js';
import { LocalDriver } from './drivers/local.driver.js';
import type { StorageDriver } from './driver.js';

export interface StorageConfig {
  driver: 's3' | 'local';
  publicUrlBase: string;
  // S3 options
  s3Region?: string;
  s3Bucket?: string;
  s3Endpoint?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3ForcePathStyle?: boolean;
  // Local options
  localPath?: string;
  localPublicPathPrefix?: string;
  signingSecret?: string;
}

export function createStorage(cfg: StorageConfig): StorageDriver {
  if (cfg.driver === 's3') {
    if (!cfg.s3Bucket || !cfg.s3Region) {
      throw new Error('STORAGE_DRIVER=s3 requires S3_BUCKET and S3_REGION');
    }
    return new S3Driver({
      bucket: cfg.s3Bucket,
      region: cfg.s3Region,
      endpoint: cfg.s3Endpoint,
      accessKeyId: cfg.s3AccessKeyId,
      secretAccessKey: cfg.s3SecretAccessKey,
      forcePathStyle: cfg.s3ForcePathStyle ?? false,
      publicUrlBase: cfg.publicUrlBase,
    });
  }
  if (cfg.driver === 'local') {
    return new LocalDriver({
      basePath: cfg.localPath ?? './.local-storage',
      publicUrlBase: cfg.publicUrlBase,
      publicPathPrefix: cfg.localPublicPathPrefix ?? '/files',
      signingSecret: cfg.signingSecret ?? '',
    });
  }
  throw new Error(`Unknown STORAGE_DRIVER: ${cfg.driver}`);
}
