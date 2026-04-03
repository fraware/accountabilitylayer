import type { Request, Response, NextFunction } from 'express';

export default function usageLogger(req: Request, res: Response, next: NextFunction): void {
  console.log(
    `[API USAGE] ${new Date().toISOString()} ${req.method} ${req.originalUrl} Query: ${JSON.stringify(req.query)}`
  );
  next();
}
