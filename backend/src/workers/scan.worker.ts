import 'dotenv/config';
import { Worker } from 'bullmq';
import { getRedis } from '../config/redis';
import { logger } from '../config/logger';
import { ScanJobPayload } from '../jobs/scan.job';
import { runScan } from '../services/scan/scanOrchestrator.service';

const QUEUE_NAME = 'clauseai-scan';

async function main() {
  const redis = getRedis();

  const worker = new Worker<ScanJobPayload>(
    QUEUE_NAME,
    async (job) => {
      const { scanJobId, companyId } = job.data;
      logger.info('Processing scan job', { jobId: job.id, scanJobId, companyId });
      await runScan(scanJobId, companyId);
    },
    { connection: redis as any }
  );

  worker.on('completed', (job) => {
    logger.info('Scan job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Scan job failed', { jobId: job?.id, error: err?.message });
  });

  logger.info('Scan worker started', { queue: QUEUE_NAME });
}

main().catch((err) => {
  logger.error('Worker crashed', { error: err.message });
  process.exit(1);
});
