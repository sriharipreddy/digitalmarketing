import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import type { Request, Response, NextFunction } from 'express';
import type { JwtPayload } from '@marketing/shared-types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User extends JwtPayload {}
  }
}

export function configurePassport(jwtSecret: string): void {
  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: jwtSecret,
        algorithms: ['HS256'],
      },
      (payload: JwtPayload, done) => done(null, payload),
    ),
  );
}

/**
 * Strict JWT authentication. Returns 401 on missing/invalid token.
 * Mount on every route that requires login.
 */
export function authenticateJwt(req: Request, res: Response, next: NextFunction): void {
  passport.authenticate('jwt', { session: false }, (err: any, user: JwtPayload | false) => {
    if (err) return next(err);
    if (!user) {
      res.status(401).json({
        error: {
          code: 'authentication_required',
          message: 'Authentication required',
          request_id: req.id,
        },
      });
      return;
    }
    req.user = user;
    next();
  })(req, res, next);
}
