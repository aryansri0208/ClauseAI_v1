import type { NormalizedVendorUsage } from '../../types/vendor.types';
export interface AnthropicServiceConfig {
    apiKey: string;
}
export declare function fetchUsage(_config: AnthropicServiceConfig): Promise<NormalizedVendorUsage['usage']>;
export declare function fetchProjects(_config: AnthropicServiceConfig): Promise<NormalizedVendorUsage['projects']>;
export declare function fetchCostMetrics(config: AnthropicServiceConfig): Promise<NormalizedVendorUsage['costMetrics']>;
export declare function getNormalizedUsage(config: AnthropicServiceConfig): Promise<NormalizedVendorUsage>;
//# sourceMappingURL=anthropic.service.d.ts.map