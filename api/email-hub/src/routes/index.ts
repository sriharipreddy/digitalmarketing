import { Router } from 'express';
import express from 'express';
import type { ListController } from '../controllers/list.controller.js';
import type { SendController } from '../controllers/send.controller.js';
import type { EmailWebhookController } from '../controllers/webhook.controller.js';
import type { MessagingController } from '../controllers/messaging.controller.js';
import { authenticateJwt } from '@marketing/shared-middleware';
import { authenticateService } from '../_helpers/authenticate-service.js';

export interface ApiRouterDeps {
  listController: ListController;
  sendController: SendController;
  messagingController: MessagingController;
  jwtSecret: string;
  serviceSelfName: string;
}

export function createApiRouter(deps: ApiRouterDeps): Router {
  const router = Router();
  const { listController, sendController, messagingController, jwtSecret, serviceSelfName } = deps;

  // Lists
  router.get('/workspaces/:workspace_id/lists', authenticateJwt, listController.list);
  router.post('/workspaces/:workspace_id/lists', authenticateJwt, listController.create);
  router.get('/workspaces/:workspace_id/lists/:list_id/preview', authenticateJwt, listController.preview);
  router.post('/workspaces/:workspace_id/lists/preview', authenticateJwt, listController.previewFilter);
  router.delete('/workspaces/:workspace_id/lists/:list_id', authenticateJwt, listController.remove);

  // User-initiated sends
  router.post('/workspaces/:workspace_id/sends', authenticateJwt, sendController.send);
  router.get('/workspaces/:workspace_id/sends', authenticateJwt, sendController.list);
  router.get('/workspaces/:workspace_id/sends/:send_id', authenticateJwt, sendController.get);

  // Service-to-service sends (campaign-manager → email-hub)
  router.post(
    '/internal/workspaces/:workspace_id/sends',
    authenticateService(jwtSecret, serviceSelfName),
    sendController.sendInternal,
  );

  // Messaging (SMS / WhatsApp / Push)
  router.post('/workspaces/:workspace_id/messages', authenticateJwt, messagingController.send);
  router.get('/workspaces/:workspace_id/messages', authenticateJwt, messagingController.list);
  router.get('/workspaces/:workspace_id/messaging/suppressions', authenticateJwt, messagingController.listSuppressions);
  router.post('/workspaces/:workspace_id/messaging/suppressions', authenticateJwt, messagingController.suppress);
  router.delete('/workspaces/:workspace_id/messaging/suppressions', authenticateJwt, messagingController.unsuppress);
  router.post('/workspaces/:workspace_id/messaging/inbound', authenticateJwt, messagingController.inbound);

  return router;
}

/**
 * SendGrid webhook needs the raw body for ECDSA signature verification.
 * Mount on a separate router so JSON body parser doesn't consume the buffer.
 */
export function createWebhookRouter(webhookController: EmailWebhookController): Router {
  const router = Router();
  router.post(
    '/webhooks/sendgrid',
    express.raw({ type: '*/*', limit: '5mb' }),
    webhookController.receive,
  );
  return router;
}
