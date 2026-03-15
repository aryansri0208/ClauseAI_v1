import type { NormalizedVendorUsage } from '../../types/vendor.types';
export interface OpenAIServiceConfig {
    apiKey: string;
}
export declare function fetchUsage(_config: OpenAIServiceConfig): Promise<NormalizedVendorUsage['usage']>;
export declare function fetchProjects(_config: OpenAIServiceConfig): Promise<NormalizedVendorUsage['projects']>;
export declare function fetchCostMetrics(config: OpenAIServiceConfig): Promise<NormalizedVendorUsage['costMetrics']>;
export declare function getNormalizedUsage(config: OpenAIServiceConfig): Promise<NormalizedVendorUsage>;
//# sourceMappingURL=openai.service.d.ts.map