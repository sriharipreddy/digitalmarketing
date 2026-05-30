import { Router } from 'express';
import type { TrackController } from '../controllers/track.controller.js';
import type { ReportController } from '../controllers/report.controller.js';
import type { GoalController } from '../controllers/goal.controller.js';
import { authenticateJwt } from '@marketing/shared-middleware';

export function createApiRouter(deps: {
  trackController: TrackController;
  reportController: ReportController;
  goalController: GoalController;
}): Router {
  const router = Router();
  const { trackController, reportController, goalController } = deps;

  // PUBLIC — browser SDKs hit these without auth.
  router.post('/track', trackController.track);
  router.post('/track/batch', trackController.trackBatch);

  // Workspace-scoped reports
  router.get('/workspaces/:workspace_id/overview', authenticateJwt, reportController.overview);
  router.get('/workspaces/:workspace_id/utm-attribution', authenticateJwt, reportController.utm);
  router.post('/workspaces/:workspace_id/funnel', authenticateJwt, reportController.funnel);

  // Conversion goals
  router.get('/workspaces/:workspace_id/goals', authenticateJwt, goalController.list);
  router.post('/workspaces/:workspace_id/goals', authenticateJwt, goalController.create);
  router.delete('/workspaces/:workspace_id/goals/:goal_id', authenticateJwt, goalController.remove);

  return router;
}
