import type { Request, Response, NextFunction } from 'express';

/**
 * In-memory sliding-window rate limiter keyed on the API key id.
 * For prod-scale, swap to Redis (sorted-set window or fixed-bucket counters).
 */
export function rateLimitPerApiKey(perMinute: number) {
  const windows = new Map<string, number[]>(); // key.id → timestamps within last 60s

  setInterval(() => {
    // Sweep stale entries every 30s to keep memory bounded
    const cutoff = Date.now() - 60_000;
    for (const [k, list] of windows) {
      const pruned = list.filter((ts) => ts > cutoff);
      if (pruned.length === 0) windows.delete(k);
      else windows.set(k, pruned);
    }
  }, 30_000).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.apiKey?.id;
    if (!key) return next();

    const now = Date.now();
    const cutoff = now - 60_000;
    const list = (windows.get(key) ?? []).filter((ts) => ts > cutoff);
    if (list.length >= perMinute) {
      const retryAfter = Math.max(1, Math.ceil((list[0]! + 60_000 - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('X-RateLimit-Limit', String(perMinute));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.status(429).json({
        error: { code: 'rate_limited', message: `Rate limit exceeded (${perMinute}/min). Retry after ${retryAfter}s.`, request_id: req.id },
      });
      return;
    }
    list.push(now);
    windows.set(key, list);
    res.setHeader('X-RateLimit-Limit', String(perMinute));
    res.setHeader('X-RateLimit-Remaining', String(perMinute - list.length));
    next();
  };
}
