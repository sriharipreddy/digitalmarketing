import { Router, type Request, type Response } from 'express';

export interface HealthCheck {
  name: string;
  check: () => Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latency_ms?: number; error?: string }>;
  critical: boolean;
}

/**
 * Mounts /health, /ready, /live on a router.
 *
 *   /health → comprehensive — checks DB, Redis, etc.
 *   /ready  → returns 200 if accepting traffic (set ready=false during shutdown)
 *   /live   → returns 200 unless the process is dead (use for container restart)
 */
export function healthRoutes(opts: {
  serviceName: string;
  version: string;
  checks: HealthCheck[];
  ready: () => boolean;
}): Router {
  const router = Router();
  const startedAt = Date.now();

  router.get('/health', async (_req: Request, res: Response) => {
    const results = await Promise.all(
      opts.checks.map(async (c) => {
        const started = Date.now();
        try {
          const result = await c.check();
          return { name: c.name, critical: c.critical, ...result, latency_ms: Date.now() - started };
        } catch (err: any) {
          return {
            name: c.name,
            critical: c.critical,
            status: 'unhealthy' as const,
            latency_ms: Date.now() - started,
            error: err.message,
          };
        }
      }),
    );

    const criticalUnhealthy = results.some((r) => r.critical && r.status === 'unhealthy');
    const overall = criticalUnhealthy ? 'unhealthy' : results.some((r) => r.status !== 'healthy') ? 'degraded' : 'healthy';

    res.status(criticalUnhealthy ? 503 : 200).json({
      status: overall,
      service: opts.serviceName,
      version: opts.version,
      uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
      dependencies: Object.fromEntries(results.map((r) => [r.name, r])),
    });
  });

  router.get('/ready', (_req, res) => res.status(opts.ready() ? 200 : 503).end());
  router.get('/live', (_req, res) => res.status(200).end());

  return router;
}
