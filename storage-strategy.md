# 💾 File Storage Strategy
## Pluggable Driver — AWS S3 OR Local Disk (deploy anywhere)

> ✅ **Decision recorded (2026-05-28):** File storage is **pluggable via env var**. The same code runs against **AWS S3** (cloud deploy) or **local disk** (on-prem / single-server deploy). Set `STORAGE_DRIVER` and the rest follows.

---

## 📋 Table of Contents

1. [The Two Storage Drivers](#the-two-storage-drivers)
2. [What Gets Stored Where](#what-gets-stored-where)
3. [Environment Variables](#environment-variables)
4. [Storage Service Abstraction](#storage-service-abstraction)
5. [Deployment Scenarios](#deployment-scenarios)
6. [Trade-offs](#trade-offs)
7. [Migration Between Drivers](#migration-between-drivers)
8. [Backups Per Driver](#backups-per-driver)
9. [Security Considerations](#security-considerations)

---

## The Two Storage Drivers

| Driver | When to use | Storage backend |
|---|---|---|
| **`s3`** | Cloud deployment (AWS, scalable) | AWS S3 (or S3-compatible: Cloudflare R2, MinIO, Backblaze B2, Wasabi, DigitalOcean Spaces) |
| **`local`** | On-premise / single-server / dev | Local disk on the host machine, mounted volume |

**Both drivers expose the same interface.** Services don't know which one is active.

```javascript
// Services call the storage service the same way regardless of driver:
const url = await storage.upload(buffer, 'workspace/ws_01H/content/image.png', { contentType: 'image/png' });
const file = await storage.download('workspace/ws_01H/content/image.png');
await storage.delete('workspace/ws_01H/content/image.png');
const signedUrl = await storage.getSignedDownloadUrl('workspace/ws_01H/content/image.png', { expiresIn: 900 });
```

---

## What Gets Stored Where

Every service that handles files uses the storage abstraction:

| Service | What it stores | Path convention |
|---|---|---|
| **marketing-core** | User avatars, agency logos | `workspace/<id>/branding/...` |
| **content-ai** | AI-generated images, uploaded brand assets | `workspace/<id>/content/...` |
| **media-hub** | Uploaded videos (originals), podcast audio, AI-generated images | `workspace/<id>/media/...` |
| **email-hub** | Email template images, uploaded subscriber CSVs | `workspace/<id>/email/...` |
| **campaign-manager** | Ad creative uploads, landing page assets | `workspace/<id>/campaigns/...` |
| **social-hub** | Social post media (images/videos before publish) | `workspace/<id>/social/...` |
| **influencer-hub** | Contract PDFs | `workspace/<id>/influencer/...` |
| **analytics-engine** | Session recordings, PDF reports, generated exports | `workspace/<id>/analytics/...` |
| **integration-service** | DSAR export ZIPs, data import CSVs | `workspace/<id>/exports/...` and `workspace/<id>/imports/...` |
| **marketing-core (backups)** | Optional encrypted DB / Redis backups (local driver only) | `system/backups/...` |

**Path discipline:** every file path starts with `workspace/<workspace_id>/` — enforced by the storage service. This makes per-workspace deletion (cancellation + RTBF) a single recursive operation.

---

## Environment Variables

```bash
# ─── CORE STORAGE SETTINGS ───────────────────────────────────────────
STORAGE_DRIVER=s3                       # 's3' | 'local'
STORAGE_PUBLIC_URL_BASE=https://cdn.yourplatform.com   # base URL for public assets

# ─── S3 DRIVER (when STORAGE_DRIVER=s3) ──────────────────────────────
# Works with AWS S3 OR any S3-compatible service (R2, MinIO, B2, Wasabi)
S3_REGION=eu-west-2
S3_BUCKET=yourplatform-files
S3_ACCESS_KEY_ID=****
S3_SECRET_ACCESS_KEY=****
S3_ENDPOINT=                            # leave empty for AWS; set for R2/MinIO etc.
S3_FORCE_PATH_STYLE=false               # true for MinIO/local-S3; false for AWS
S3_SIGNED_URL_EXPIRY_SECONDS=900        # 15 minutes default

# ─── LOCAL DRIVER (when STORAGE_DRIVER=local) ────────────────────────
LOCAL_STORAGE_PATH=/var/lib/marketing/files         # absolute path on disk
LOCAL_STORAGE_SERVE_VIA=nginx                       # 'nginx' | 'express'
                                                    # 'nginx'  = Nginx serves directly from /files/* (fast)
                                                    # 'express' = service streams files (slower; use only in dev)
LOCAL_STORAGE_MAX_DISK_USAGE_PERCENT=85             # alert at 85% disk full
LOCAL_STORAGE_PUBLIC_PATH_PREFIX=/files             # URL prefix for public-served files

# ─── SHARED LIMITS ───────────────────────────────────────────────────
STORAGE_MAX_UPLOAD_MB_DEFAULT=50
STORAGE_MAX_UPLOAD_MB_VIDEO=500
STORAGE_MAX_UPLOAD_MB_AUDIO=200
STORAGE_MAX_UPLOAD_MB_IMAGE=10
STORAGE_MAX_UPLOAD_MB_DOCUMENT=50
STORAGE_MAX_UPLOAD_MB_CSV=100
STORAGE_ALLOWED_MIME_TYPES_JSON='{"image":["image/jpeg","image/png","image/webp","image/gif"],"video":["video/mp4","video/quicktime"],"audio":["audio/mpeg","audio/mp4","audio/wav"],"document":["application/pdf"],"csv":["text/csv"]}'

# ─── ANTIVIRUS (recommended in production for both drivers) ──────────
ANTIVIRUS_ENABLED=true                  # both drivers; ClamAV daemon
CLAMAV_HOST=clamav
CLAMAV_PORT=3310
```

### Per-Service env Notes

Each service that handles files uses these **same** vars (defined in `packages/shared-config`). Services do **not** define their own bucket names — they get a path prefix automatically from the storage service.

Example service-side config (added to every service that uploads files):
```bash
# Inherited from shared-config; no need to redefine per service
STORAGE_DRIVER=...
S3_BUCKET=... OR LOCAL_STORAGE_PATH=...
```

---

## Storage Service Abstraction

Lives in `packages/shared-storage/`. Services import it.

```typescript
// packages/shared-storage/src/storage.service.ts
export interface StorageDriver {
  upload(buffer: Buffer, key: string, opts: UploadOptions): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;       // for workspace deletion + RTBF
  exists(key: string): Promise<boolean>;
  getSignedDownloadUrl(key: string, opts: { expiresIn: number }): Promise<string>;
  getPublicUrl(key: string): string;                 // for public assets
  list(prefix: string, opts?: { limit?: number }): Promise<StorageObject[]>;
  copy(sourceKey: string, destKey: string): Promise<void>;
  stat(key: string): Promise<{ size: number; lastModified: Date; contentType: string }>;
}

// Factory selects driver based on env
export function createStorage(): StorageDriver {
  const driver = process.env.STORAGE_DRIVER;
  if (driver === 's3')    return new S3Driver();
  if (driver === 'local') return new LocalDriver();
  throw new Error(`Unknown STORAGE_DRIVER: ${driver}. Use 's3' or 'local'.`);
}

export const storage = createStorage();
```

### S3 Driver (works with AWS S3 + R2 + MinIO + B2 + Wasabi)

```typescript
// packages/shared-storage/src/drivers/s3.driver.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
         ListObjectsV2Command, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class S3Driver implements StorageDriver {
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl: string;

  constructor() {
    this.client = new S3Client({
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT || undefined,         // for R2/MinIO
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });
    this.bucket = process.env.S3_BUCKET!;
    this.publicBaseUrl = process.env.STORAGE_PUBLIC_URL_BASE!;
  }

  async upload(buffer, key, opts) {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: opts.contentType,
      CacheControl: opts.cacheControl,
      Metadata: opts.metadata,
    }));
    return key;
  }

  async getSignedDownloadUrl(key, { expiresIn }) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
  }

  async deletePrefix(prefix) {
    // List + batch-delete (S3 supports 1000 keys per request)
    let continuationToken;
    do {
      const res = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: continuationToken }));
      if (res.Contents?.length) {
        await this.client.send(new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: res.Contents.map(o => ({ Key: o.Key! })) },
        }));
      }
      continuationToken = res.NextContinuationToken;
    } while (continuationToken);
  }

  // ... rest of interface
}
```

### Local Driver

```typescript
// packages/shared-storage/src/drivers/local.driver.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export class LocalDriver implements StorageDriver {
  private basePath: string;
  private publicBaseUrl: string;
  private publicPathPrefix: string;
  private signingSecret: string;

  constructor() {
    this.basePath = process.env.LOCAL_STORAGE_PATH!;
    this.publicBaseUrl = process.env.STORAGE_PUBLIC_URL_BASE!;
    this.publicPathPrefix = process.env.LOCAL_STORAGE_PUBLIC_PATH_PREFIX || '/files';
    this.signingSecret = process.env.JWT_SECRET!;  // reuses platform secret
  }

  async upload(buffer, key, opts) {
    const filePath = this.resolvePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    // Optionally write a .meta sidecar for contentType
    if (opts.contentType) {
      await fs.writeFile(filePath + '.meta', JSON.stringify({ contentType: opts.contentType }));
    }
    return key;
  }

  async download(key) {
    return fs.readFile(this.resolvePath(key));
  }

  async delete(key) {
    try { await fs.unlink(this.resolvePath(key)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    try { await fs.unlink(this.resolvePath(key) + '.meta'); } catch (_) {}
  }

  async deletePrefix(prefix) {
    const dir = this.resolvePath(prefix);
    await fs.rm(dir, { recursive: true, force: true });
  }

  async getSignedDownloadUrl(key, { expiresIn }) {
    // HMAC-signed URL: nginx checks the signature via X-Accel-Redirect or auth subrequest
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const signature = crypto.createHmac('sha256', this.signingSecret)
      .update(`${key}:${expires}`).digest('hex');
    return `${this.publicBaseUrl}${this.publicPathPrefix}/${encodeURIComponent(key)}?expires=${expires}&sig=${signature}`;
  }

  getPublicUrl(key) {
    return `${this.publicBaseUrl}${this.publicPathPrefix}/${encodeURIComponent(key)}`;
  }

  private resolvePath(key: string): string {
    // Prevent path traversal: refuse keys containing '..'
    if (key.includes('..')) throw new Error('Invalid key: contains ..');
    return path.join(this.basePath, key);
  }

  // ... rest of interface
}
```

### Nginx Configuration for Local Driver

When `STORAGE_DRIVER=local` and `LOCAL_STORAGE_SERVE_VIA=nginx`, Nginx serves files directly with signed-URL verification:

```nginx
# /etc/nginx/conf.d/files.conf

# Internal location — only accessible via X-Accel-Redirect
location /protected-files/ {
    internal;
    alias /var/lib/marketing/files/;
}

# Public location — Nginx verifies HMAC signature, then serves via internal
location /files/ {
    # Lua / OpenResty pseudo-code (use auth_request to a small Express endpoint instead if no Lua)
    auth_request /internal/verify-signed-url;
    auth_request_set $verified_key $upstream_http_x_storage_key;

    # Or simpler: use a tiny Node.js helper that does the HMAC check and 302s to /protected-files/<key>

    expires 7d;
    add_header Cache-Control "public, max-age=604800";
}

# Verification subrequest
location = /internal/verify-signed-url {
    internal;
    proxy_pass http://marketing-core:3100/internal/verify-signed-url;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header X-Original-URI $request_uri;
}
```

---

## Deployment Scenarios

### Scenario A — AWS Cloud Deploy

```
STORAGE_DRIVER=s3
S3_REGION=eu-west-2
S3_BUCKET=yourplatform-files-prod
S3_ENDPOINT=                            # leave empty for AWS
S3_FORCE_PATH_STYLE=false
STORAGE_PUBLIC_URL_BASE=https://cdn.yourplatform.com  # CloudFront distribution
```

**Architecture:**
- Files in AWS S3 (private bucket, block all public access)
- CloudFront in front for caching + signed URLs
- IAM role on ECS tasks grants S3 access (no static credentials)
- Files survive ECS task restarts (S3 is shared)
- Cross-region replication for DR

### Scenario B — Cloudflare R2 (S3-compatible, no egress fees)

```
STORAGE_DRIVER=s3                       # same code as AWS S3
S3_REGION=auto
S3_BUCKET=yourplatform-files
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
S3_FORCE_PATH_STYLE=false
S3_ACCESS_KEY_ID=****
S3_SECRET_ACCESS_KEY=****
STORAGE_PUBLIC_URL_BASE=https://files.yourplatform.com   # via Cloudflare public bucket
```

**Why this is great:** R2 has **zero egress fees** (you pay only storage + operations). For a marketing platform serving lots of customer-uploaded media, this can save 60-90% vs AWS S3.

### Scenario C — Single Server / On-Premise Deploy

```
STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=/var/lib/marketing/files
LOCAL_STORAGE_SERVE_VIA=nginx
LOCAL_STORAGE_PUBLIC_PATH_PREFIX=/files
STORAGE_PUBLIC_URL_BASE=https://yourplatform.com
LOCAL_STORAGE_MAX_DISK_USAGE_PERCENT=85
```

**Architecture:**
- Files on local disk at `/var/lib/marketing/files/`
- Nginx serves files directly from disk (no Node.js round-trip)
- Volume mount → backed up via `rsync` to backup server nightly
- ECS task uses **persistent volume** (EFS) so files survive container restarts; OR runs as single-instance with a regular volume

**When to use:**
- Cost-sensitive deployments
- Data residency requirements (data MUST stay on the customer's own servers)
- Enterprise on-premise deployments
- Local development (default `STORAGE_DRIVER=local` for `yarn dev`)

### Scenario D — MinIO (Self-Hosted S3-compatible)

```
STORAGE_DRIVER=s3                       # MinIO speaks S3 protocol
S3_REGION=us-east-1                     # MinIO ignores this, but required by SDK
S3_BUCKET=yourplatform-files
S3_ENDPOINT=https://minio.internal:9000
S3_FORCE_PATH_STYLE=true                # required for MinIO
S3_ACCESS_KEY_ID=****
S3_SECRET_ACCESS_KEY=****
STORAGE_PUBLIC_URL_BASE=https://files.yourplatform.com
```

**When to use:**
- Self-hosted but want S3 semantics (multi-server, distributed)
- Already running MinIO for other workloads
- Avoiding cloud-vendor lock-in

### Scenario E — Hybrid (different drivers per environment)

| Environment | Driver | Why |
|---|---|---|
| Local dev | `local` | No AWS account needed; fast iteration |
| Staging | `s3` (AWS) | Realistic; cheap (small data volume) |
| Production | `s3` (R2) | Cost-effective at scale (no egress fees) |
| Enterprise on-prem | `local` | Data residency requirement |
| EU-only customer | `s3` (AWS eu-west-2) | GDPR data residency |

The platform code is **identical** across all these. Only the env file changes.

---

## Trade-offs

| Concern | `s3` driver | `local` driver |
|---|---|---|
| **Multi-server / horizontal scaling** | ✅ All servers share storage | ⚠️ Requires NFS / EFS mount; otherwise single-server only |
| **Durability** | ✅ 11 nines (S3) | ⚠️ Depends on disk RAID + backups |
| **Cost** | Pay per GB stored + egress (R2 no egress) | Disk cost only |
| **Setup complexity** | AWS / R2 / MinIO account needed | Just a folder |
| **Backups** | Built-in versioning + cross-region | Need rsync / restic manually |
| **Public CDN** | CloudFront / Cloudflare integration | Nginx + Cloudflare in front |
| **Signed URLs** | Native S3 presigned URLs | HMAC signature verified by Nginx subrequest |
| **Performance for serving** | CDN-edge cached globally | Single server (unless CDN in front) |
| **Auto-resize / WebP** | Cloudflare Polish or imgproxy in front | imgproxy / sharp side-car |
| **Vendor lock-in** | S3 API is standard (R2/MinIO/B2/Wasabi all speak it) | None |
| **Disaster recovery** | Cross-region replication trivial | Manual `rsync` to backup site |
| **GDPR data residency** | Choose AWS region | Customer's own server |
| **Local dev experience** | Need AWS creds OR run MinIO locally | Just works |

---

## Migration Between Drivers

You can migrate from `local` → `s3` (or vice versa) without code changes:

```bash
# Migrate local → S3
node scripts/migrate-storage.js \
  --from local --from-path /var/lib/marketing/files \
  --to s3 --to-bucket yourplatform-files-prod --to-region eu-west-2

# Migrate S3 → R2 (cost savings)
node scripts/migrate-storage.js \
  --from s3 --from-bucket yourplatform-files-prod --from-region eu-west-2 \
  --to s3 --to-bucket yourplatform-files --to-endpoint https://<id>.r2.cloudflarestorage.com
```

The script (lives in `scripts/migrate-storage.js`):
1. Lists all files in source
2. Copies each to destination (preserving keys, content types, metadata)
3. Verifies checksums
4. Updates `STORAGE_DRIVER` env var
5. Rolling restart of services
6. After 7-day verification window, delete source

Zero downtime — old driver keeps serving until env var flipped.

---

## Backups Per Driver

### S3 driver
- **AWS S3:** versioning on; cross-region replication to secondary bucket; lifecycle to Glacier after 90 days
- **R2:** versioning on; cross-region replication via R2's geo-distribution
- **MinIO:** versioning on; configure bucket replication to a second MinIO cluster

### Local driver
- Daily `restic` snapshot to backup server / S3 / Backblaze B2
- Retention: 7 daily + 4 weekly + 6 monthly
- Encrypted at rest (restic default)
- Test restore monthly

```bash
# /etc/cron.daily/marketing-storage-backup
restic -r b2:yourplatform-backups:files backup /var/lib/marketing/files \
  --tag daily --password-file /etc/restic-password

restic -r b2:yourplatform-backups:files forget \
  --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
```

---

## Security Considerations

### Universal (both drivers)
- Path enforcement: every key starts with `workspace/<workspace_id>/` (storage service rejects others)
- Path traversal prevention: keys containing `..` are rejected
- MIME-type verification via magic bytes (not just extension)
- Antivirus scan via ClamAV before storing (production)
- File-size limits enforced per type
- EXIF metadata stripped from images (GPS removal — privacy)

### S3-specific
- `Block all public access` ON at bucket level
- Files served only via signed URLs (15-min default expiry)
- IAM role-based access from ECS (no static credentials in env vars where possible)
- S3 Object Lock on backup bucket (immutable for 30 days — ransomware protection)
- Server-Side Encryption (SSE-KMS or SSE-S3) for at-rest encryption

### Local-specific
- Storage path owned by non-root user (`marketing:marketing`)
- File permissions: `640` (owner rw, group r, other none)
- Volume mounted with `noexec,nosuid` flags
- Nginx serves files only after HMAC signature verification (no directory listing)
- Disk-full monitoring → alert at 85%, page at 95%
- RAID-1 or RAID-10 on the storage volume

### Per-workspace KEK encryption for sensitive files
Some files (DSAR exports, signed contracts) are AES-encrypted at the application layer with per-workspace KEK **before** being handed to the storage driver — defence in depth, works the same on S3 or local.

---

## Phase Recommendation

| Phase | Recommended driver | Why |
|---|---|---|
| Local dev | `local` | Zero AWS dependency; fast |
| Staging | `s3` (AWS, small bucket) | Match production architecture |
| **Production launch (default)** | **`s3` (Cloudflare R2)** | No egress fees, cheap, S3-compatible |
| Enterprise on-prem | `local` (with NFS/EFS for HA) | Data residency requirement |
| GDPR-strict customers | `s3` (AWS eu-west-2) | Data must stay in EU |

---

## Implementation Checklist

For each service that touches files:

- [ ] Replace direct `@aws-sdk/client-s3` calls with `storage` service from `packages/shared-storage`
- [ ] Remove service-specific `S3_BUCKET_*` env vars (use shared `S3_BUCKET` + path prefix)
- [ ] All file paths use `workspace/<workspace_id>/...` prefix
- [ ] All public-facing URLs go via `storage.getSignedDownloadUrl()` or `storage.getPublicUrl()`
- [ ] Hard-code nothing — driver-agnostic everywhere
- [ ] Integration tests run against both drivers (CI matrix)
- [ ] Workspace deletion calls `storage.deletePrefix('workspace/' + workspaceId + '/')`
- [ ] Documentation in service's README mentions storage driver compatibility
