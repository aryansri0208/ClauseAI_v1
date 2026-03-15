"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function getEnv(key, defaultValue) {
    const value = process.env[key] ?? defaultValue;
    if (value === undefined)
        throw new Error(`Missing required env: ${key}`);
    return value;
}
function getEnvOptional(key) {
    return process.env[key];
}
exports.env = {
    NODE_ENV: getEnv('NODE_ENV', 'development'),
    PORT: parseInt(getEnv('PORT', '3000'), 10),
    CORS_ORIGIN: getEnvOptional('CORS_ORIGIN'),
    SUPABASE_URL: getEnv('SUPABASE_URL'),
    SUPABASE_ANON_KEY: getEnv('SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    REDIS_URL: getEnv('REDIS_URL', 'redis://localhost:6379'),
    ENCRYPTION_KEY: getEnv('ENCRYPTION_KEY'),
    AWS_REGION: getEnvOptional('AWS_REGION') ?? 'us-east-1',
    AWS_ACCESS_KEY_ID: getEnvOptional('AWS_ACCESS_KEY_ID'),
    AWS_SECRET_ACCESS_KEY: getEnvOptional('AWS_SECRET_ACCESS_KEY'),
    AWS_SECRETS_PREFIX: getEnvOptional('AWS_SECRETS_PREFIX') ?? 'clauseai/',
    LOG_LEVEL: getEnvOptional('LOG_LEVEL') ?? 'info',
};
//# sourceMappingURL=env.js.map