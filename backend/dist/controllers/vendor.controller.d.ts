import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
export type ConnectVendorPayload = {
    company_id?: string;
    vendor_name: 'OpenAI' | 'Anthropic' | 'Google Vertex AI' | 'Pinecone' | 'LangSmith';
    api_key: string;
};
export declare function connectVendor(req: AuthenticatedRequest, res: Response): Promise<void>;
//# sourceMappingURL=vendor.controller.d.ts.map