import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { sessions, users } from './schema';
import { eq, gt } from 'drizzle-orm';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; role: 'admin' | 'agent'; name: string };
}

export async function loadSession(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const sessionId = req.cookies?.session;
  if (!sessionId) return next();

  const [session] = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session || session.expiresAt < new Date()) return next();

  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role, name: users.name })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (user) req.user = user;
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}
