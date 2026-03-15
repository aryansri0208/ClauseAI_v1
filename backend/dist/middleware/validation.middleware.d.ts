import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
type Source = 'body' | 'query' | 'params';
export declare function validate(schema: ZodSchema, source?: Source): (req: Request, _res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=validation.middleware.d.ts.map