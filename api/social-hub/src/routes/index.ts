import { Router } from 'express';
import type { AccountController } from '../controllers/account.controller.js';
import type { PostController } from '../controllers/post.controller.js';
import { authenticateJwt } from '@marketing/shared-middleware';

export function createApiRouter(deps: {
  accountController: AccountController;
  postController: PostController;
}): Router {
  const router = Router();
  const { accountController, postController } = deps;

  // Accounts
  router.get('/workspaces/:workspace_id/accounts', authenticateJwt, accountController.list);
  router.post('/workspaces/:workspace_id/accounts/connect/start', authenticateJwt, accountController.startConnect);
  router.post('/workspaces/:workspace_id/accounts/connect/finish', authenticateJwt, accountController.finishConnect);
  router.delete('/workspaces/:workspace_id/accounts/:account_id', authenticateJwt, accountController.disconnect);

  // Posts
  router.get('/workspaces/:workspace_id/posts', authenticateJwt, postController.list);
  router.post('/workspaces/:workspace_id/posts', authenticateJwt, postController.create);
  router.post('/workspaces/:workspace_id/posts/:post_id/publish', authenticateJwt, postController.publish);
  router.delete('/workspaces/:workspace_id/posts/:post_id', authenticateJwt, postController.remove);

  return router;
}
