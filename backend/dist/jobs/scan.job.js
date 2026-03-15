"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createScanQueue = createScanQueue;
exports.addScanJob = addScanJob;
const bullmq_1 = require("bullmq");
const QUEUE_NAME = 'clauseai-scan';
function createScanQueue(connection) {
    return new bullmq_1.Queue(QUEUE_NAME, {
        connection: connection,
        defaultJobOptions: {
            attempts: 2,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: { count: 100 },
        },
    });
}
async function addScanJob(redis, payload) {
    const queue = createScanQueue(redis);
    await queue.add('scan', payload);
    await queue.close();
}
//# sourceMappingURL=scan.job.js.map