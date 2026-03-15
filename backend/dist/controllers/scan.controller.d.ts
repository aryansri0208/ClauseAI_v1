import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
export declare function startScan(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function getScanStatus(req: AuthenticatedRequest, res: Response): Promise<void>;
//# sourceMappingURL=scan.controller.d.ts.map