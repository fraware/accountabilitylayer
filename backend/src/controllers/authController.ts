import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';

const users = [
  { username: 'auditor1', password: 'password', role: 'auditor' },
  { username: 'agent1', password: 'password', role: 'agent' },
  { username: 'admin1', password: 'password', role: 'admin' },
];

export function login(req: Request, res: Response): void {
  const { username, password } = req.body as { username?: string; password?: string };
  const user = users.find((u) => u.username === username && u.password === password);
  if (!user) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ message: 'Server configuration error' });
    return;
  }

  const token = jwt.sign(
    { username: user.username, role: user.role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
  res.status(200).json({ token });
}
