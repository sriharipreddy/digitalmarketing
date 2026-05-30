import { Router } from 'express';
import type { ImageController } from '../controllers/image.controller.js';
import type { VideoController } from '../controllers/video.controller.js';
import { authenticateJwt } from '@marketing/shared-middleware';

export function createApiRouter(deps: {
  imageController: ImageController;
  videoController: VideoController;
}): Router {
  const router = Router();
  const { imageController, videoController } = deps;

  // Image generation
  router.get('/workspaces/:workspace_id/images', authenticateJwt, imageController.list);
  router.post('/workspaces/:workspace_id/images/generate', authenticateJwt, imageController.generate);
  router.delete('/workspaces/:workspace_id/images/:image_id', authenticateJwt, imageController.remove);

  // Video import + transcript
  router.get('/workspaces/:workspace_id/videos', authenticateJwt, videoController.list);
  router.get('/workspaces/:workspace_id/videos/:video_id', authenticateJwt, videoController.get);
  router.post('/workspaces/:workspace_id/videos/import/youtube', authenticateJwt, videoController.importYouTube);
  router.post('/workspaces/:workspace_id/videos/:video_id/transcribe', authenticateJwt, videoController.transcribe);
  router.delete('/workspaces/:workspace_id/videos/:video_id', authenticateJwt, videoController.remove);

  return router;
}
