"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedis = getRedis;
exports.closeRedis = closeRedis;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
const logger_1 = require("./logger");
let redis = null;
function getRedis() {
    if (!redis) {
        redis = new ioredis_1.default(env_1.env.REDIS_URL, {
            maxRetriesPerRequest: null,
            retryStrategy(times) {
                const delay = Math.min(times * 100, 3000);
                return delay;
            },
        });
        redis.on('error', (err) => logger_1.logger.error('Redis error', { error: err.message }));
        redis.on('connect', () => logger_1.logger.debug('Redis connected'));
    }
    return redis;
}
async function closeRedis() {
    if (redis) {
        await redis.quit();
        redis = null;
    }
}
//# sourceMappingURL=redis.js.map