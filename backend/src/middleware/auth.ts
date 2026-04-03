import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

export function verifyToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ message: 'Server configuration error' });
    return;
  }

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }
    req.user = decoded as Express.Request['user'];
    next();
  });
}

export function authorize(roles: string | string[] = []) {
  const list = typeof roles === 'string' ? [roles] : roles;
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || (list.length > 0 && !list.includes(String(req.user.role)))) {
      res.status(403).json({ message: 'Forbidden: insufficient privileges' });
      return;
    }
    next();
  };
}
