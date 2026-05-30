import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Guards the internal /events endpoint. Uses the same HMAC scheme as
 * notification-service so internal publishers reuse one client.
 *   X-Notif-Timestamp: <unix seconds>
 *   X-Notif-Signature: hex(hmac_sha256(secret, ts + "." + body))
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
