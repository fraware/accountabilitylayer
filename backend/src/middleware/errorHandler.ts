import type { Request, Response, NextFunction } from 'express';

export default function errorHandler(
  err: Error & { status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(err.stack);
  const statusCode = err.status || 500;
  res.status(statusCode).json({ error: err.message });
}
