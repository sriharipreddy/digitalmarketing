import { Router } from 'express';
import type { KeywordController } from '../controllers/keyword.controller.js';
import type { LocalController } from '../controllers/local.controller.js';
import type { AsoController } from '../controllers/aso.controller.js';
import { authenticateJwt } from '@marketing/shared-middleware';

export interface ApiRouterDeps {
  keywordController: KeywordController;
  localController: LocalController;
  asoController: AsoController;
}

export function createApiRouter(deps: ApiRouterDeps): Router {
  const router = Router();
  const { keywordController, localController, asoController } = deps;

  // ─── Keywords ─────────────────────────────────────────────────────────
  router.get('/workspaces/:workspace_id/keywords', authenticateJwt, keywordController.list);
  router.post('/workspaces/:workspace_id/keywords/research', authenticateJwt, keywordController.research);
  router.post('/workspaces/:workspace_id/keywords', authenticateJwt, keywordController.save);
  router.delete('/workspaces/:workspace_id/keywords/:keyword_id', authenticateJwt, keywordController.remove);

  // ─── Local SEO listings + reviews + citations ─────────────────────────
  router.get('/workspaces/:workspace_id/local/listings', authenticateJwt, localController.listListings);
  router.post('/workspaces/:workspace_id/local/listings', authenticateJwt, localController.createListing);
  router.delete('/workspaces/:workspace_id/local/listings/:listing_id', authenticateJwt, localController.removeListing);
  router.post('/workspaces/:workspace_id/local/listings/:listing_id/sync', authenticateJwt, localController.syncReviews);
  router.get('/workspaces/:workspace_id/local/listings/:listing_id/reviews', authenticateJwt, localController.listReviews);
  router.post('/workspaces/:workspace_id/local/listings/:listing_id/reviews/:review_id/respond', authenticateJwt, localController.respondReview);
  router.get('/workspaces/:workspace_id/local/listings/:listing_id/citations', authenticateJwt, localController.listCitations);
  router.post('/workspaces/:workspace_id/local/listings/:listing_id/citations/seed', authenticateJwt, localController.seedCitations);
  router.patch('/workspaces/:workspace_id/local/citations/:citation_id', authenticateJwt, localController.updateCitationStatus);

  // ─── ASO ──────────────────────────────────────────────────────────────
  router.get('/workspaces/:workspace_id/aso/apps', authenticateJwt, asoController.list);
  router.post('/workspaces/:workspace_id/aso/apps', authenticateJwt, asoController.track);
  router.post('/workspaces/:workspace_id/aso/apps/:app_id/sync', authenticateJwt, asoController.sync);
  router.delete('/workspaces/:workspace_id/aso/apps/:app_id', authenticateJwt, asoController.remove);

  return router;
}
