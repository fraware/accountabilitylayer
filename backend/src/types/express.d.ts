import type { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { username?: string; role?: string; id?: string };
      telemetryContext?: unknown;
      telemetrySpan?: unknown;
    }
  }
}

export {};
