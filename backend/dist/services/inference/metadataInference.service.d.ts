import type { NormalizedAISystem } from '../../types/system.types';
import type { SystemType, Environment } from '../../types/system.types';
export interface InferredMetadata {
    team_owner: string;
    system_type: SystemType;
    environment: Environment;
    compliance_risk: 'low' | 'medium' | 'high';
    confidence: number;
}
/**
 * Simple heuristic inference for team ownership, system type, and compliance risk.
 */
export declare function inferMetadata(system: NormalizedAISystem): InferredMetadata;
//# sourceMappingURL=metadataInference.service.d.ts.map