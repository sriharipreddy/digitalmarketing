import { Router } from 'express';
import type { CompetitorController } from '../controllers/competitor.controller.js';
import type { AutopilotController } from '../controllers/autopilot.controller.js';
import { authenticateJwt } from '@marketing/shared-middleware';

export function createApiRouter(deps: {
  competitorController: CompetitorController;
  autopilotController: AutopilotController;
}): Router {
  const router = Router();
  const { competitorController, autopilotController } = deps;

  // Competitors
  router.get('/workspaces/:workspace_id/competitors', authenticateJwt, competitorController.list);
  router.post('/workspaces/:workspace_id/competitors', authenticateJwt, competitorController.create);
  router.post('/workspaces/:workspace_id/competitors/:competitor_id/analyze', authenticateJwt, competitorController.analyze);
  router.post('/workspaces/:workspace_id/competitors/:competitor_id/spy', authenticateJwt, competitorController.spyAds);
  router.delete('/workspaces/:workspace_id/competitors/:competitor_id', authenticateJwt, competitorController.remove);

  // Ads
  router.get('/workspaces/:workspace_id/ads', authenticateJwt, competitorController.listAds);

  // Autopilot
  router.get('/workspaces/:workspace_id/autopilot/recommendations', authenticateJwt, autopilotController.list);
  router.post('/workspaces/:workspace_id/autopilot/scan', authenticateJwt, autopilotController.scan);
  router.post(
    '/workspaces/:workspace_id/autopilot/recommendations/:recommendation_id/act',
    authenticateJwt,
    autopilotController.act,
  );

  return router;
}
