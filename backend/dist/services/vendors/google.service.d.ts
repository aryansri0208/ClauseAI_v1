import type { NormalizedVendorUsage } from '../../types/vendor.types';
export interface GoogleServiceConfig {
    apiKey: string;
}
export declare function fetchUsage(_config: GoogleServiceConfig): Promise<NormalizedVendorUsage['usage']>;
export declare function fetchProjects(_config: GoogleServiceConfig): Promise<NormalizedVendorUsage['projects']>;
export declare function fetchCostMetrics(config: GoogleServiceConfig): Promise<NormalizedVendorUsage['costMetrics']>;
export declare function getNormalizedUsage(config: GoogleServiceConfig): Promise<NormalizedVendorUsage>;
//# sourceMappingURL=google.service.d.ts.map