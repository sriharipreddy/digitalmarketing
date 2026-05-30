import { Router } from 'express';
import type { CampaignController } from '../controllers/campaign.controller.js';
import type { UtmController } from '../controllers/utm.controller.js';
import type { OneClickController } from '../controllers/one-click.controller.js';
import { authenticateJwt } from '@marketing/shared-middleware';

export function createApiRouter(deps: {
  campaignController: CampaignController;
  utmController: UtmController;
  oneClickController: OneClickController;
}): Router {
  const router = Router();
  const { campaignController, utmController, oneClickController } = deps;

  // Public UTM click redirect
  router.get('/u/:short_code', utmController.publicRedirect);

  // Campaigns CRUD
  router.get('/workspaces/:workspace_id/campaigns', authenticateJwt, campaignController.list);
  router.get('/workspaces/:workspace_id/campaigns/:campaign_id', authenticateJwt, campaignController.get);
  router.post('/workspaces/:workspace_id/campaigns', authenticateJwt, campaignController.create);
  router.patch('/workspaces/:workspace_id/campaigns/:campaign_id', authenticateJwt, campaignController.update);
  router.delete('/workspaces/:workspace_id/campaigns/:campaign_id', authenticateJwt, campaignController.remove);
  router.post('/workspaces/:workspace_id/campaigns/:campaign_id/dispatch', authenticateJwt, campaignController.dispatch);

  // UTM links
  router.get('/workspaces/:workspace_id/utm-links', authenticateJwt, utmController.list);
  router.post('/workspaces/:workspace_id/utm-links', authenticateJwt, utmController.create);
  router.delete('/workspaces/:workspace_id/utm-links/:link_id', authenticateJwt, utmController.remove);

  // One-Click Market Capture — flagship SSE orchestration
  router.post('/workspaces/:workspace_id/one-click', authenticateJwt, oneClickController.start);

  return router;
}
