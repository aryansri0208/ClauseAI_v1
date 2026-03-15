import type { NormalizedVendorUsage } from '../../types/vendor.types';
export interface PineconeServiceConfig {
    apiKey: string;
}
export declare function fetchUsage(_config: PineconeServiceConfig): Promise<NormalizedVendorUsage['usage']>;
export declare function fetchProjects(_config: PineconeServiceConfig): Promise<NormalizedVendorUsage['projects']>;
export declare function fetchCostMetrics(config: PineconeServiceConfig): Promise<NormalizedVendorUsage['costMetrics']>;
export declare function getNormalizedUsage(config: PineconeServiceConfig): Promise<NormalizedVendorUsage>;
//# sourceMappingURL=pinecone.service.d.ts.map