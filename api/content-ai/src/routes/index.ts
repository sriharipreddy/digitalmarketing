import { Router } from 'express';
import type { BrandVoiceController } from '../controllers/brand-voice.controller.js';
import type { GenerationController } from '../controllers/generation.controller.js';
import type { ContentPieceController } from '../controllers/content-piece.controller.js';
import { authenticateJwt } from '@marketing/shared-middleware';

export function createApiRouter(deps: {
  brandVoiceController: BrandVoiceController;
  generationController: GenerationController;
  contentPieceController: ContentPieceController;
}): Router {
  const router = Router();
  const { brandVoiceController, generationController, contentPieceController } = deps;

  router.get('/workspaces/:workspace_id/brand-voices', authenticateJwt, brandVoiceController.list);
  router.post('/workspaces/:workspace_id/brand-voices', authenticateJwt, brandVoiceController.create);
  router.delete('/workspaces/:workspace_id/brand-voices/:voice_id', authenticateJwt, brandVoiceController.remove);

  router.post('/workspaces/:workspace_id/generate', authenticateJwt, generationController.generate);
  router.get('/workspaces/:workspace_id/generations', authenticateJwt, generationController.listRecent);

  // Content pieces (saved + schedulable)
  router.get('/workspaces/:workspace_id/pieces', authenticateJwt, contentPieceController.list);
  router.get('/workspaces/:workspace_id/pieces/:piece_id', authenticateJwt, contentPieceController.get);
  router.post('/workspaces/:workspace_id/pieces', authenticateJwt, contentPieceController.create);
  router.post('/workspaces/:workspace_id/pieces/from-generation', authenticateJwt, contentPieceController.createFromGeneration);
  router.patch('/workspaces/:workspace_id/pieces/:piece_id', authenticateJwt, contentPieceController.update);
  router.post('/workspaces/:workspace_id/pieces/:piece_id/translate', authenticateJwt, contentPieceController.translate);
  router.delete('/workspaces/:workspace_id/pieces/:piece_id', authenticateJwt, contentPieceController.remove);

  return router;
}
