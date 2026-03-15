import { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { env } from '../config/env';

export interface AuthUser {
  id: string;
  email: string;
}

const DEV_MOCK_USER: AuthUser = {
  id: '11111111-1111-1111-1111-111111111111', // ✅ valid UUID
  email: 'dev@clauseai.local',
};

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    if (env.NODE_ENV === 'development') {
      req.user = DEV_MOCK_USER;
      next();
      return;
    }
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const supabase = getSupabaseAdmin();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn('Auth failed', { error: error?.message });
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    req.user = {
      id: "11111111-1111-1111-1111-111111111111",
      email: "dev@clauseai.local"
    };
    next();
  } catch (err) {
    logger.error('Auth middleware error', { error: err instanceof Error ? err.message : err });
    res.status(500).json({ error: 'Authentication failed' });
  }
}
