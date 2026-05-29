import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { assertValidKey, type StorageDriver, type UploadOptions, type StorageObject } from '../driver.js';

interface S3DriverOpts {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
  publicUrlBase: string;
}

export class S3Driver implements StorageDriver {
  private client: S3Client;
  private bucket: string;
  private publicUrlBase: string;

  constructor(opts: S3DriverOpts) {
    this.bucket = opts.bucket;
    this.publicUrlBase = opts.publicUrlBase;
    this.client = new S3Client({
      region: opts.region,
      endpoint: opts.endpoint || undefined,
      forcePathStyle: opts.forcePathStyle,
      ...(opts.accessKeyId && opts.secretAccessKey
        ? { credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey } }
        : {}),
    });
  }

  async upload(buffer: Buffer, key: string, opts: UploadOptions = {}): Promise<string> {
    assertValidKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: opts.contentType,
        CacheControl: opts.cacheControl,
        Metadata: opts.metadata,
      }),
    );
    return key;
  }

  async download(key: string): Promise<Buffer> {
    assertValidKey(key);
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const stream = res.Body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    assertValidKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async deletePrefix(prefix: string): Promise<void> {
    let continuationToken: string | undefined;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      if (res.Contents?.length) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: res.Contents.map((o) => ({ Key: o.Key! })) },
          }),
        );
      }
      continuationToken = res.NextContinuationToken;
    } while (continuationToken);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return false;
      throw err;
    }
  }

  async getSignedDownloadUrl(key: string, opts: { expiresIn: number }): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: opts.expiresIn,
    });
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrlBase}/${encodeURIComponent(key)}`;
  }

  async list(prefix: string, opts: { limit?: number } = {}): Promise<StorageObject[]> {
    const res = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, MaxKeys: opts.limit }),
    );
    return (res.Contents ?? []).map((o) => ({
      key: o.Key!,
      size: o.Size ?? 0,
      lastModified: o.LastModified ?? new Date(),
    }));
  }

  async copy(sourceKey: string, destKey: string): Promise<void> {
    assertValidKey(destKey);
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: destKey,
        CopySource: `${this.bucket}/${encodeURIComponent(sourceKey)}`,
      }),
    );
  }

  async stat(key: string): Promise<{ size: number; lastModified: Date; contentType?: string }> {
    assertValidKey(key);
    const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    return {
      size: res.ContentLength ?? 0,
      lastModified: res.LastModified ?? new Date(),
      contentType: res.ContentType,
    };
  }
}
