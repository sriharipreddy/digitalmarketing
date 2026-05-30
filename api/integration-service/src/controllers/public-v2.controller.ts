import type { Request, Response, NextFunction } from 'express';

/**
 * Public v2 API surface.
 *
 * The v2 surface intentionally mirrors a customer-facing OpenAPI 3.1 spec
 * (returns flat JSON envelopes, version header). For Phase 4 we only ship
 * 2 endpoints to prove the API-key + rate-limit pipeline; full coverage
 * lives behind these stubs and gets implemented per-domain as we expand.
 */
export class PublicV2Controller {
  /** GET /v2/me — returns the workspace + scopes for the API key in use. */
  me = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const key = req.apiKey!;
      res.json({
        data: {
          workspace_id: key.workspace_id,
          api_key_id: key.id,
          scopes: key.scopes,
          rate_limit: { limit: Number(res.getHeader('X-RateLimit-Limit')), remaining: Number(res.getHeader('X-RateLimit-Remaining')) },
        },
      });
    } catch (err) { next(err); }
  };

  /** GET /v2/openapi.json — a stub OpenAPI 3.1 doc that lists the v2 endpoints. */
  openapi = (_req: Request, res: Response): void => {
    res.json({
      openapi: '3.1.0',
      info: {
        title: 'Marketing Platform v2 API',
        version: '2.0.0',
        description: 'Customer-facing REST API. Authenticate with Bearer mk_<prefix>_<secret>.',
      },
      servers: [{ url: 'https://api.yourdomain.com/v2', description: 'Production' }],
      paths: {
        '/me': {
          get: {
            summary: 'Identify the API key in use',
            security: [{ bearer: [] }],
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            workspace_id: { type: 'string', format: 'uuid' },
                            api_key_id: { type: 'string', format: 'uuid' },
                            scopes: { type: 'array', items: { type: 'string' } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        securitySchemes: {
          bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'mk_<prefix>_<secret>' },
        },
      },
    });
  };
}
