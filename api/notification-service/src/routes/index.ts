import { Router } from 'express';
import type { NotificationController } from '../controllers/notification.controller.js';
import { authenticateJwt } from '@marketing/shared-middleware';
import { authenticateInternal } from '../_helpers/authenticate-internal.js';

export function createApiRouter(deps: {
  notificationController: NotificationController;
  internalPublishSecret: string;
}): Router {
  const router = Router();
  const { notificationController, internalPublishSecret } = deps;

  // INTERNAL — service-to-service publish, HMAC-signed
  router.post(
    '/internal/publish',
    authenticateInternal(internalPublishSecret),
    notificationController.publish,
  );

  // User-facing endpoints
  router.get('/workspaces/:workspace_id/notifications', authenticateJwt, notificationController.list);
  router.get('/workspaces/:workspace_id/notifications/unread-count', authenticateJwt, notificationController.unreadCount);
  router.post('/workspaces/:workspace_id/notifications/:notification_id/read', authenticateJwt, notificationController.markRead);
  router.post('/workspaces/:workspace_id/notifications/read-all', authenticateJwt, notificationController.markAllRead);

  // SSE stream
  router.get('/workspaces/:workspace_id/stream', authenticateJwt, notificationController.stream);

  return router;
}
