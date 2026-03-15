import type { NormalizedVendorUsage } from '../../types/vendor.types';
import type { NormalizedAISystem } from '../../types/system.types';
/**
 * Converts raw vendor usage into normalized AI systems.
 * Example: OpenAI API usage → "Customer Support Chatbot" system.
 */
export declare function normalizeToSystems(vendorUsage: NormalizedVendorUsage): NormalizedAISystem[];
//# sourceMappingURL=systemDiscovery.service.d.ts.map