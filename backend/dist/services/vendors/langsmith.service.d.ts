import type { NormalizedVendorUsage } from '../../types/vendor.types';
export interface LangSmithServiceConfig {
    apiKey: string;
}
export declare function fetchUsage(_config: LangSmithServiceConfig): Promise<NormalizedVendorUsage['usage']>;
export declare function fetchProjects(_config: LangSmithServiceConfig): Promise<NormalizedVendorUsage['projects']>;
export declare function fetchCostMetrics(config: LangSmithServiceConfig): Promise<NormalizedVendorUsage['costMetrics']>;
export declare function getNormalizedUsage(config: LangSmithServiceConfig): Promise<NormalizedVendorUsage>;
//# sourceMappingURL=langsmith.service.d.ts.map