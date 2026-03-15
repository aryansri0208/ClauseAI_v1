import dotenv from 'dotenv';

dotenv.config();

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) throw new Error(`Missing required env: ${key}`);
  return value;
}

function getEnvOptional(key: string): string | undefined {
  return process.env[key];
}

export const env = {
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
} as const;
