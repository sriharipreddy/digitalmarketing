import type { Request, Response, NextFunction } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    workspaceId?: string;
  }
}

/**
 * Injects req.workspaceId from the JWT. Enforces that any :workspace_id URL
 * param matches the token's workspace (except platform admins, who can target
 * any workspace via the X-Admin-Workspace header).
 *
 * Agency-owner → client-workspace access checks belong in marketing-core
 * (this middleware doesn't know about agency relationships).
 */
export function workspaceGuard(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({
      error: { code: 'authentication_required', message: 'Authentication required', request_id: req.id },
    });
    return;
  }

  if (user.type === 'platform_admin') {
    req.workspaceId = (req.headers['x-admin-workspace'] as string | undefined) ?? user.workspace_id;
  } else {
    req.workspaceId = user.workspace_id;
  }

  const urlWorkspace = req.params.workspace_id ?? req.params.workspaceId;
  if (urlWorkspace && urlWorkspace !== req.workspaceId) {
    if (user.type !== 'platform_admin' && user.type !== 'agency_owner') {
      res.status(403).json({
        error: { code: 'permission_denied', message: 'Cross-workspace access denied', request_id: req.id },
      });
      return;
    }
    // For agency_owner cross-workspace, marketing-core's specific routes must verify the link.
    req.workspaceId = urlWorkspace;
  }

  next();
}
