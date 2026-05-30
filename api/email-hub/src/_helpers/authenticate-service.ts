import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface ServiceContext {
  type: 'service';
  from: string;
  workspace_id?: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    service?: ServiceContext;
  }
}

/**
 * Validates a service-to-service JWT signed with the shared JWT_SECRET.
 * The token must carry { type: 'service', from, to: 'email-hub' }.
 */
export function authenticateService(jwtSecret: string, selfName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      res.status(401).json({
        error: { code: 'authentication_required', message: 'Missing bearer token', request_id: req.id },
      });
      return;
    }
    const token = auth.slice(7);
    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      res.status(401).json({
        error: { code: 'authentication_required', message: 'Invalid token', request_id: req.id },
      });
      return;
    }
    if (decoded.type !== 'service') {
      res.status(403).json({
        error: { code: 'permission_denied', message: 'User tokens not accepted on this route', request_id: req.id },
      });
      return;
    }
    if (decoded.to && decoded.to !== selfName) {
      res.status(403).json({
        error: { code: 'permission_denied', message: `Token addressed to "${decoded.to}", not "${selfName}"`, request_id: req.id },
      });
      return;
    }
    req.service = { type: 'service', from: decoded.from, workspace_id: decoded.workspace_id };
    next();
  };
}
