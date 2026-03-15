import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
export interface ApiError extends Error {
    statusCode?: number;
    code?: string;
}
export declare function errorMiddleware(err: ApiError | ZodError, _req: Request, res: Response, _next: NextFunction): void;
//# sourceMappingURL=error.middleware.d.ts.map