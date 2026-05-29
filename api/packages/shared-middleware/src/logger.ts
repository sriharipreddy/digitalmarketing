import pino from 'pino';
import pinoHttpDefault from 'pino-http';
const pinoHttp: any = pinoHttpDefault;

export function createLogger(serviceName: string, level = 'info'): pino.Logger {
  return pino({
    name: serviceName,
    level,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.password_confirmation',
        'req.body.refresh_token',
        'req.body.access_token',
        'req.body.oauth_access_token',
        '*.api_key',
        '*.totp_secret',
        'res.headers["set-cookie"]',
      ],
      censor: '[REDACTED]',
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export function requestLogger(logger: pino.Logger): any {
  return pinoHttp({
    logger,
    genReqId: (req: any) => req.id,
    customLogLevel: (_req: any, res: any, err: any) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  });
}
