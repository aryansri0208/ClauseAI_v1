import { Request, Response, NextFunction } from 'express';
export interface AuthUser {
    id: string;
    email: string;
}
export interface AuthenticatedRequest extends Request {
    user?: AuthUser;
}
export declare function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.middleware.d.ts.map