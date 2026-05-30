import { Router } from 'express';
import type { ApiKeyController } from '../controllers/api-key.controller.js';
import type { WebhookController } from '../controllers/webhook.controller.js';
import type { PublicV2Controller } from '../controllers/public-v2.controller.js';
import type { EventController } from '../controllers/event.controller.js';
import type { ImportController } from '../controllers/import.controller.js';
import type { ExportController } from '../controllers/export.controller.js';
import { authenticateJwt } from '@marketing/shared-middleware';
import { authenticateInternal } from '../_helpers/authenticate-internal.js';
import { apiKeyAuth } from '../_helpers/api-key-auth.js';
import { rateLimitPerApiKey } from '../_helpers/rate-limit.js';
import type { Models } from '../models/index.js';

export interface ApiRouterDeps {
  models: Models;
  apiKeyController: ApiKeyController;
  webhookController: WebhookController;
  publicV2Controller: PublicV2Controller;
  eventController: EventController;
  importController: ImportController;
  exportController: ExportController;
  internalPublishSecret: string;
  ratePerMinute: number;
}

export function createApiRouter(deps: ApiRouterDeps): Router {
  const router = Router();
  const {
    models,
    apiKeyController,
    webhookController,
    publicV2Controller,
    eventController,
    importController,
    exportController,
    internalPublishSecret,
    ratePerMinute,
  } = deps;

  // ─── INTERNAL — sibling-service event ingress ─────────────────────────
  router.post('/internal/events', authenticateInternal(internalPublishSecret), eventController.receive);

  // ─── DASHBOARD — workspace admin (JWT) ────────────────────────────────
  // API keys
  router.get('/workspaces/:workspace_id/api-keys', authenticateJwt, apiKeyController.list);
  router.post('/workspaces/:workspace_id/api-keys', authenticateJwt, apiKeyController.create);
  router.post('/workspaces/:workspace_id/api-keys/:key_id/revoke', authenticateJwt, apiKeyController.revoke);

  // Webhooks
  router.get('/workspaces/:workspace_id/webhooks', authenticateJwt, webhookController.list);
  router.post('/workspaces/:workspace_id/webhooks', authenticateJwt, webhookController.create);
  router.patch('/workspaces/:workspace_id/webhooks/:webhook_id', authenticateJwt, webhookController.update);
  router.delete('/workspaces/:workspace_id/webhooks/:webhook_id', authenticateJwt, webhookController.remove);

  // Webhook deliveries (log)
  router.get('/workspaces/:workspace_id/webhook-deliveries', authenticateJwt, webhookController.listDeliveries);

  // Data imports (HubSpot, Mailchimp, Klaviyo, CSV)
  router.get('/workspaces/:workspace_id/imports', authenticateJwt, importController.list);
  router.post('/workspaces/:workspace_id/imports', authenticateJwt, importController.create);
  router.get('/workspaces/:workspace_id/imports/:import_id', authenticateJwt, importController.get);
  router.post('/workspaces/:workspace_id/imports/:import_id/run', authenticateJwt, importController.run);

  // Data exports (DSAR + others)
  router.get('/workspaces/:workspace_id/exports', authenticateJwt, exportController.list);
  router.get('/workspaces/:workspace_id/exports/:export_id', authenticateJwt, exportController.get);
  router.post('/workspaces/:workspace_id/exports/dsar', authenticateJwt, exportController.createDsar);

  // ─── PUBLIC v2 (API key) ──────────────────────────────────────────────
  // OpenAPI spec is unauthenticated so tooling can discover the surface.
  router.get('/v2/openapi.json', publicV2Controller.openapi);
  // Everything else gated by API key + rate limit.
  router.use('/v2', apiKeyAuth(models), rateLimitPerApiKey(ratePerMinute));
  router.get('/v2/me', publicV2Controller.me);

  return router;
}
