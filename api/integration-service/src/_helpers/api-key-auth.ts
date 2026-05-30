import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { Models } from '../models/index.js';

declare module 'express-serve-static-core' {
  interface Request {
    apiKey?: {
      id: string;
      workspace_id: string;
      scopes: string[];
    };
  }
}

/**
 * Public v2 API authentication.
 *
 * Wire format: `Authorization: Bearer mk_<prefix>_<secret>`
 *   - `prefix` is the first 8 chars (shown in dashboards / logs)
 *   - `secret` is 32 random url-safe chars
 *
 * On match:
 *   1. We look up by `prefix` (indexed),
 *   2. SHA-256 the full key and timing-safe compare against the stored hash,
 *   3. Reject if revoked / expired,
 *   4. Update `last_used_at` (fire-and-forget).
 */
export function apiKeyAuth(models: Models) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const auth = req.headers.authorization ?? '';
    const match = auth.match(/^Bearer\s+(mk_[a-z0-9]{1,16})_([A-Za-z0-9_-]{16,128})$/);
    if (!match) {
      res.status(401).json({
        error: { code: 'authentication_required', message: 'API key required (Bearer mk_<prefix>_<secret>)', request_id: req.id },
      });
      return;
    }
    const prefix = match[1]!;
    const secret = match[2]!;

    const key = await models.ApiKey.findOne({ where: { prefix } });
    if (!key) {
      res.status(401).json({
        error: { code: 'authentication_required', message: 'Invalid API key', request_id: req.id },
      });
      return;
    }
    if (key.status !== 'active') {
      res.status(401).json({
        error: { code: 'authentication_required', message: `API key is ${key.status}`, request_id: req.id },
      });
      return;
    }
    if (key.expires_at && key.expires_at < new Date()) {
      await key.update({ status: 'expired' });
      res.status(401).json({
        error: { code: 'authentication_required', message: 'API key has expired', request_id: req.id },
      });
      return;
    }

    // Compare hash of the full bearer string
    const fullKey = `${prefix}_${secret}`;
    const computedHash = sha256(fullKey);
    if (!safeEqual(computedHash, key.hash)) {
      res.status(401).json({
        error: { code: 'authentication_required', message: 'Invalid API key', request_id: req.id },
      });
      return;
    }

    req.apiKey = {
      id: key.id,
      workspace_id: key.workspace_id,
      scopes: parseJsonField(key.scopes) ?? [],
    };

    // Fire-and-forget last_used_at update
    void key.update({ last_used_at: new Date() }).catch(() => undefined);
    next();
  };
}

export function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, 'utf8');
    const bBuf = Buffer.from(b, 'utf8');
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

function parseJsonField<T>(value: T | string | null): T | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return value as unknown as T; }
  }
  return value;
}
