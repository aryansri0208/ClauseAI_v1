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

  /** Used for AES-256-GCM encryption of vendor API keys (min 32 chars). */
  API_KEY_SECRET: ((): string => {
    const v = process.env.API_KEY_SECRET ?? '';
    if (!v || v.length < 32) {
      throw new Error(
        'API_KEY_SECRET is missing or invalid. Set a secure environment variable with at least 32 characters.'
      );
    }
    return v;
  })(),

  /** @deprecated Prefer API_KEY_SECRET for vendor keys. Kept for backward compatibility. */
  ENCRYPTION_KEY: getEnvOptional('ENCRYPTION_KEY'),

  AWS_REGION: getEnvOptional('AWS_REGION') ?? 'us-east-1',
  AWS_ACCESS_KEY_ID: getEnvOptional('AWS_ACCESS_KEY_ID'),
  AWS_SECRET_ACCESS_KEY: getEnvOptional('AWS_SECRET_ACCESS_KEY'),
  AWS_SECRETS_PREFIX: getEnvOptional('AWS_SECRETS_PREFIX') ?? 'clauseai/',

  GCP_BQ_PROJECT_ID: getEnvOptional('GCP_BQ_PROJECT_ID'),
  GCP_BQ_DATASET_ID: getEnvOptional('GCP_BQ_DATASET_ID'),
  GCP_BQ_BILLING_TABLE: getEnvOptional('GCP_BQ_BILLING_TABLE'),
  GOOGLE_APPLICATION_CREDENTIALS: getEnvOptional('GOOGLE_APPLICATION_CREDENTIALS'),

  LOG_LEVEL: getEnvOptional('LOG_LEVEL') ?? 'info',
} as const;
