import type { Request, Response, NextFunction } from 'express';

type Action = 'c' | 'r' | 'u' | 'd';

/**
 * Permission check based on the module + action stored in the JWT payload.
 * Mirrors the existing LicensedTaxi RBAC pattern.
 *
 * Usage:
 *   router.post('/keywords', authenticateJwt, workspaceGuard,
 *     requirePermission('seo_keywords', 'c'), keywordController.create);
 */
export function requirePermission(moduleName: string, action: Action) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({
        error: { code: 'authentication_required', message: 'Authentication required', request_id: req.id },
      });
      return;
    }

    // Platform admins bypass module permissions
    if (user.type === 'platform_admin') {
      next();
      return;
    }

    // Owners have all permissions within their workspace
    if (user.role === 'owner') {
      next();
      return;
    }

    const perm = user.permissions?.find((p) => p.module_name === moduleName);
    if (!perm || perm.access?.[action] !== true) {
      res.status(403).json({
        error: {
          code: 'permission_denied',
          message: `Required: ${action} on ${moduleName}`,
          request_id: req.id,
        },
      });
      return;
    }

    next();
  };
}
