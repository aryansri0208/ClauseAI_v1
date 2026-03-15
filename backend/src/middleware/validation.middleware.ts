import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type Source = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = (req as any)[source];
    try {
      (req as any)[source] = schema.parse(data);
      next();
    } catch (err) {
      next(err instanceof ZodError ? err : new Error('Validation failed'));
    }
  };
}
