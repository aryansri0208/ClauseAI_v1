"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const logger_1 = require("../config/logger");
const scanOrchestrator_service_1 = require("../services/scan/scanOrchestrator.service");
const QUEUE_NAME = 'clauseai-scan';
async function main() {
    const redis = (0, redis_1.getRedis)();
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { scanJobId, companyId } = job.data;
        logger_1.logger.info('Processing scan job', { jobId: job.id, scanJobId, companyId });
        await (0, scanOrchestrator_service_1.runScan)(scanJobId, companyId);
    }, { connection: redis });
    worker.on('completed', (job) => {
        logger_1.logger.info('Scan job completed', { jobId: job.id });
    });
    worker.on('failed', (job, err) => {
        logger_1.logger.error('Scan job failed', { jobId: job?.id, error: err?.message });
    });
    logger_1.logger.info('Scan worker started', { queue: QUEUE_NAME });
}
main().catch((err) => {
    logger_1.logger.error('Worker crashed', { error: err.message });
    process.exit(1);
});
//# sourceMappingURL=scan.worker.js.map