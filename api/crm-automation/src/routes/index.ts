import { Router } from 'express';
import type { ContactController } from '../controllers/contact.controller.js';
import type { FormController } from '../controllers/form.controller.js';
import type { SegmentController } from '../controllers/segment.controller.js';
import type { NpsController } from '../controllers/nps.controller.js';
import type { RfmController } from '../controllers/rfm.controller.js';
import { authenticateJwt } from '@marketing/shared-middleware';

export interface ApiRouterDeps {
  contactController: ContactController;
  formController: FormController;
  segmentController: SegmentController;
  npsController: NpsController;
  rfmController: RfmController;
}

export function createApiRouter(deps: ApiRouterDeps): Router {
  const router = Router();
  const { contactController, formController, segmentController, npsController, rfmController } = deps;

  // PUBLIC form endpoints — no auth, must come before the authenticated ones
  router.get('/public/forms/:slug', formController.publicGet);
  router.post('/public/forms/:slug/submit', formController.publicSubmit);

  // Contacts (authenticated)
  router.get('/workspaces/:workspace_id/contacts', authenticateJwt, contactController.list);
  router.get('/workspaces/:workspace_id/contacts/:contact_id', authenticateJwt, contactController.get);
  router.post('/workspaces/:workspace_id/contacts', authenticateJwt, contactController.create);
  router.patch('/workspaces/:workspace_id/contacts/:contact_id', authenticateJwt, contactController.update);
  router.delete('/workspaces/:workspace_id/contacts/:contact_id', authenticateJwt, contactController.remove);

  // Forms (authenticated CRUD)
  router.get('/workspaces/:workspace_id/forms', authenticateJwt, formController.list);
  router.post('/workspaces/:workspace_id/forms', authenticateJwt, formController.create);
  router.delete('/workspaces/:workspace_id/forms/:form_id', authenticateJwt, formController.remove);

  // Segments
  router.get('/workspaces/:workspace_id/segments', authenticateJwt, segmentController.list);
  router.post('/workspaces/:workspace_id/segments', authenticateJwt, segmentController.create);
  router.delete('/workspaces/:workspace_id/segments/:segment_id', authenticateJwt, segmentController.remove);
  router.post('/workspaces/:workspace_id/segments/preview', authenticateJwt, segmentController.preview);
  router.get('/workspaces/:workspace_id/segments/:segment_id/members', authenticateJwt, segmentController.members);
  router.post('/workspaces/:workspace_id/segments/:segment_id/evaluate', authenticateJwt, segmentController.evaluate);

  // NPS
  router.post('/workspaces/:workspace_id/nps', authenticateJwt, npsController.submit);
  router.get('/workspaces/:workspace_id/nps', authenticateJwt, npsController.list);
  router.get('/workspaces/:workspace_id/nps/summary', authenticateJwt, npsController.summary);

  // RFM
  router.post('/workspaces/:workspace_id/rfm/analyze', authenticateJwt, rfmController.analyze);
  router.get('/workspaces/:workspace_id/rfm/summary', authenticateJwt, rfmController.summary);
  router.get('/workspaces/:workspace_id/rfm/segments/:label', authenticateJwt, rfmController.listBySegment);

  return router;
}
