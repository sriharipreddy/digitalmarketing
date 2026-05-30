import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Internal publish endpoint guard.
 * The caller signs `${timestamp}.${body}` with HMAC-SHA256 using the shared secret and
 * sends headers:
 *   X-Notif-Timestamp: <unix seconds>
 *   X-Notif-Signature: <hex>
 *
 * We reject requests with a >5-minute timestamp skew or invalid signature.
 */
export function authenticateInternal(sharedSecret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!sharedSecret) {
      res.status(503).json({
        error: { code: 'misconfigured', message: 'INTERNAL_PUBLISH_SECRET is not set', request_id: req.id },
      });
      return;
    }
    const ts = req.headers['x-notif-timestamp'] as string | undefined;
    const sig = req.headers['x-notif-signature'] as string | undefined;
    if (!ts || !sig) {
      res.status(401).json({
        error: { code: 'authentication_required', message: 'Missing signature headers', request_id: req.id },
      });
      return;
    }
    const skew = Math.abs(Math.floor(Date.now() / 1000) - parseInt(ts, 10));
    if (Number.isNaN(skew) || skew > 300) {
      res.status(401).json({
        error: { code: 'authentication_required', message: 'Timestamp skew too large', request_id: req.id },
      });
      return;
    }
    // Body needs to be the raw JSON string. Express body-parser has stashed
    // the parsed object on req.body — we recompute by stringifying. Both sides
    // must use JSON.stringify with no whitespace.
    const bodyStr = JSON.stringify(req.body ?? {});
    const expected = crypto.createHmac('sha256', sharedSecret).update(`${ts}.${bodyStr}`).digest('hex');
    if (!safeEqual(expected, sig)) {
      res.status(401).json({
        error: { code: 'authentication_required', message: 'Invalid signature', request_id: req.id },
      });
      return;
    }
    next();
  };
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
