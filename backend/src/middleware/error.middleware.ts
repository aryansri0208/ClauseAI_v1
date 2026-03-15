import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { ZodError } from 'zod';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorMiddleware(
  err: ApiError | ZodError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
    return;
  }

  const statusCode = (err as ApiError).statusCode ?? 500;
  const message = statusCode >= 500 ? 'Internal server error' : (err as ApiError).message;

  if (statusCode >= 500) {
    logger.error('Unhandled error', {
      error: (err as Error).message,
      stack: (err as Error).stack,
    });
  }

  res.status(statusCode).json({
    error: message,
    ...((err as ApiError).code && { code: (err as ApiError).code }),
  });
}
