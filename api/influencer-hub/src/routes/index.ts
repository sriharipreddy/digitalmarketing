import { Router } from 'express';
import type { InfluencerController } from '../controllers/influencer.controller.js';
import type { OutreachController } from '../controllers/outreach.controller.js';
import { authenticateJwt } from '@marketing/shared-middleware';

export function createApiRouter(deps: {
  influencerController: InfluencerController;
  outreachController: OutreachController;
}): Router {
  const router = Router();
  const { influencerController, outreachController } = deps;

  // Influencers
  router.get('/workspaces/:workspace_id/influencers', authenticateJwt, influencerController.list);
  router.get('/workspaces/:workspace_id/influencers/:influencer_id', authenticateJwt, influencerController.get);
  router.post('/workspaces/:workspace_id/influencers/discover', authenticateJwt, influencerController.discover);
  router.patch('/workspaces/:workspace_id/influencers/:influencer_id', authenticateJwt, influencerController.update);
  router.delete('/workspaces/:workspace_id/influencers/:influencer_id', authenticateJwt, influencerController.remove);

  // Outreach
  router.get('/workspaces/:workspace_id/outreach', authenticateJwt, outreachController.list);
  router.post('/workspaces/:workspace_id/outreach/draft', authenticateJwt, outreachController.draft);
  router.post('/workspaces/:workspace_id/outreach/:outreach_id/send', authenticateJwt, outreachController.send);
  router.post('/workspaces/:workspace_id/outreach/:outreach_id/reply', authenticateJwt, outreachController.reply);
  router.delete('/workspaces/:workspace_id/outreach/:outreach_id', authenticateJwt, outreachController.remove);

  return router;
}
