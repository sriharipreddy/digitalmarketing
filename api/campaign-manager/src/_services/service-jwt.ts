import jwt from 'jsonwebtoken';

/**
 * Mint a short-lived service-to-service JWT for calling peer services.
 * Mirrors the ServiceJwtPayload shape from shared-types.
 */
export function mintServiceToken(opts: {
  jwtSecret: string;
  from: string;
  to: string;
  workspace_id?: string;
  ttlSeconds?: number;
}): string {
  const ttl = opts.ttlSeconds ?? 60;
  return jwt.sign(
    {
      type: 'service',
      from: opts.from,
      to: opts.to,
      workspace_id: opts.workspace_id,
    },
    opts.jwtSecret,
    { expiresIn: ttl },
  );
}
