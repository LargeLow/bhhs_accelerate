import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../db';
import { users, sessions } from '../schema';
import { eq } from 'drizzle-orm';
import type { AuthenticatedRequest } from '../auth';

export const authRouter = Router();

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.insert(sessions).values({ id: sessionId, userId: user.id, expiresAt });

  res.cookie('session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
  });

  return res.json({ id: user.id, email: user.email, role: user.role, name: user.name });
});

authRouter.post('/logout', async (req: Request, res: Response) => {
  const sessionId = req.cookies?.session;
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }
  res.clearCookie('session');
  return res.json({ ok: true });
});

authRouter.get('/me', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  return res.json(req.user);
});
