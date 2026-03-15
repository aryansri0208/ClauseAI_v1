import { Queue } from 'bullmq';
import Redis from 'ioredis';
export interface ScanJobPayload {
    scanJobId: string;
    companyId: string;
}
export declare function createScanQueue(connection: Redis): Queue<ScanJobPayload, any, string, ScanJobPayload, any, string>;
export declare function addScanJob(redis: Redis, payload: ScanJobPayload): Promise<void>;
//# sourceMappingURL=scan.job.d.ts.map