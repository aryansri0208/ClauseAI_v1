export declare const VENDOR_NAMES: readonly ["OpenAI", "Anthropic", "Google Vertex AI", "Pinecone", "LangSmith"];
export type VendorName = (typeof VENDOR_NAMES)[number];
export declare function isVendorName(name: string): name is VendorName;
export interface VendorConnectionRow {
    id: string;
    company_id: string;
    vendor_name: string;
    encrypted_api_key: string;
    connection_status: 'active' | 'failed' | 'revoked';
    created_at: string;
    updated_at: string;
}
export interface NormalizedVendorUsage {
    vendor: VendorName;
    projects: Array<{
        id: string;
        name: string;
    }>;
    usage: Array<{
        projectId?: string;
        modelOrResource?: string;
        usageAmount?: number;
        unit?: string;
    }>;
    costMetrics: Array<{
        projectId?: string;
        amount: number;
        currency: string;
        period?: string;
    }>;
}
//# sourceMappingURL=vendor.types.d.ts.map