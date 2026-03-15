export type SystemType = 'Model API' | 'Agent' | 'Vector DB' | 'Pipeline' | 'Other';
export type Environment = 'production' | 'staging' | 'development';
export interface AISystemRow {
    id: string;
    company_id: string;
    name: string;
    vendor: string;
    system_type: string | null;
    team_owner: string | null;
    environment: string | null;
    monthly_cost_estimate: number | null;
    created_at: string;
}
export interface NormalizedAISystem {
    name: string;
    vendor: string;
    systemType?: SystemType;
    teamOwner?: string;
    environment?: Environment;
    monthlyCostEstimate?: number;
    rawProjectId?: string;
    rawModelOrResource?: string;
}
export interface SystemInferenceRow {
    id: string;
    system_id: string;
    field_name: string;
    inferred_value: string | null;
    user_override: string | null;
    confidence_score: number | null;
}
export type InferableField = 'team_owner' | 'system_type' | 'environment';
//# sourceMappingURL=system.types.d.ts.map