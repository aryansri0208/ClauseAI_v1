import { Queue } from 'bullmq';
import Redis from 'ioredis';

const QUEUE_NAME = 'clauseai-scan';

export interface ScanJobPayload {
  scanJobId: string;
  companyId: string;
}

export function createScanQueue(connection: Redis) {
  return new Queue<ScanJobPayload>(QUEUE_NAME, {
    connection: connection as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
    },
  });
}

export async function addScanJob(redis: Redis, payload: ScanJobPayload): Promise<void> {
  const queue = createScanQueue(redis);
  await queue.add('scan' as const, payload);
  await queue.close();
}
