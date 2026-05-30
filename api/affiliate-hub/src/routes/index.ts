import { Router } from 'express';
import type { ProgramController } from '../controllers/program.controller.js';
import type { AffiliateController } from '../controllers/affiliate.controller.js';
import type { TrackingLinkController } from '../controllers/tracking-link.controller.js';
import type { CommissionController } from '../controllers/commission.controller.js';
import { authenticateJwt } from '@marketing/shared-middleware';

export function createApiRouter(deps: {
  programController: ProgramController;
  affiliateController: AffiliateController;
  trackingLinkController: TrackingLinkController;
  commissionController: CommissionController;
}): Router {
  const router = Router();
  const { programController, affiliateController, trackingLinkController, commissionController } = deps;

  // PUBLIC click redirect (must come before the JWT-protected routes)
  router.get('/a/:short_code', trackingLinkController.publicRedirect);
  // PUBLIC affiliate self-apply
  router.post('/public/workspaces/:workspace_id/apply', affiliateController.publicApply);

  // Programs (authenticated)
  router.get('/workspaces/:workspace_id/programs', authenticateJwt, programController.list);
  router.get('/workspaces/:workspace_id/programs/:program_id', authenticateJwt, programController.get);
  router.post('/workspaces/:workspace_id/programs', authenticateJwt, programController.create);
  router.patch('/workspaces/:workspace_id/programs/:program_id', authenticateJwt, programController.update);
  router.delete('/workspaces/:workspace_id/programs/:program_id', authenticateJwt, programController.remove);

  // Affiliates
  router.get('/workspaces/:workspace_id/affiliates', authenticateJwt, affiliateController.list);
  router.get('/workspaces/:workspace_id/affiliates/:affiliate_id', authenticateJwt, affiliateController.get);
  router.patch('/workspaces/:workspace_id/affiliates/:affiliate_id', authenticateJwt, affiliateController.updateStatus);
  router.delete('/workspaces/:workspace_id/affiliates/:affiliate_id', authenticateJwt, affiliateController.remove);

  // Tracking links
  router.get('/workspaces/:workspace_id/tracking-links', authenticateJwt, trackingLinkController.list);
  router.post('/workspaces/:workspace_id/tracking-links', authenticateJwt, trackingLinkController.create);
  router.delete('/workspaces/:workspace_id/tracking-links/:link_id', authenticateJwt, trackingLinkController.remove);

  // Commissions
  router.get('/workspaces/:workspace_id/commissions', authenticateJwt, commissionController.list);
  router.post('/workspaces/:workspace_id/commissions', authenticateJwt, commissionController.record);
  router.post('/workspaces/:workspace_id/commissions/:commission_id/transition', authenticateJwt, commissionController.transition);
  router.get('/workspaces/:workspace_id/commissions/summary', authenticateJwt, commissionController.summary);

  return router;
}
