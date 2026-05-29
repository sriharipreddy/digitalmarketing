import { Router } from 'express';
import express from 'express';
import type { AuthController } from '../controllers/auth.controller.js';
import type { WorkspaceController } from '../controllers/workspace.controller.js';
import type { MemberController } from '../controllers/member.controller.js';
import type { AuditController } from '../controllers/audit.controller.js';
import type { EmailVerifyController } from '../controllers/email-verify.controller.js';
import type { TotpController } from '../controllers/totp.controller.js';
import type { BillingController } from '../controllers/billing.controller.js';
import { authenticateJwt, workspaceGuard } from '@marketing/shared-middleware';

export interface ApiRouterDeps {
  authController: AuthController;
  workspaceController: WorkspaceController;
  memberController: MemberController;
  auditController: AuditController;
  emailVerifyController: EmailVerifyController;
  totpController: TotpController;
  billingController: BillingController;
}

export function createApiRouter(deps: ApiRouterDeps): Router {
  const router = Router();
  const {
    authController,
    workspaceController,
    memberController,
    auditController,
    emailVerifyController,
    totpController,
    billingController,
  } = deps;

  // ─── Public auth routes ────────────────────────────────────────────────
  router.post('/auth/register', authController.register);
  router.post('/auth/login', authController.login);
  router.post('/auth/refresh-token', authController.refresh);
  router.post('/auth/logout', authController.logout);

  // Email verification (public)
  router.post('/auth/verify-email', emailVerifyController.verify);
  router.post('/auth/resend-verification', emailVerifyController.resend);

  // 2FA login step (public — challenge token gates it)
  router.post('/auth/2fa/verify', totpController.loginVerify);

  // ─── Authenticated routes ─────────────────────────────────────────────
  router.get('/users/me', authenticateJwt, workspaceGuard, authController.me);

  // 2FA management (authenticated)
  router.post('/users/me/2fa/begin', authenticateJwt, totpController.begin);
  router.post('/users/me/2fa/confirm', authenticateJwt, totpController.confirm);
  router.post('/users/me/2fa/disable', authenticateJwt, totpController.disable);

  // Workspaces the current user belongs to
  router.get('/workspaces', authenticateJwt, workspaceController.list);
  router.get('/workspaces/:workspace_id', authenticateJwt, workspaceController.get);
  router.patch('/workspaces/:workspace_id', authenticateJwt, workspaceController.update);
  router.delete('/workspaces/:workspace_id', authenticateJwt, workspaceController.requestDeletion);

  // Members of a workspace
  router.get('/workspaces/:workspace_id/members', authenticateJwt, memberController.list);
  router.post('/workspaces/:workspace_id/members/invite', authenticateJwt, memberController.invite);
  router.patch(
    '/workspaces/:workspace_id/members/:member_id',
    authenticateJwt,
    memberController.updateRole,
  );
  router.delete(
    '/workspaces/:workspace_id/members/:member_id',
    authenticateJwt,
    memberController.remove,
  );

  // Invitations
  router.post('/invitations/accept', authenticateJwt, memberController.acceptInvite);

  // Audit log (workspace-scoped)
  router.get('/workspaces/:workspace_id/audit-log', authenticateJwt, auditController.list);

  // Billing
  router.get('/workspaces/:workspace_id/billing', authenticateJwt, billingController.get);
  router.post('/workspaces/:workspace_id/billing/checkout', authenticateJwt, billingController.checkout);

  return router;
}

/**
 * Stripe webhook needs the RAW body so its signature can be verified.
 * Mount it on a separate Express router so we don't pollute the JSON body parser.
 */
export function createWebhookRouter(billingController: BillingController): Router {
  const router = Router();
  router.post(
    '/billing/webhook',
    express.raw({ type: 'application/json' }),
    billingController.webhook,
  );
  return router;
}
