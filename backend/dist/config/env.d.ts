export declare const env: {
    readonly NODE_ENV: string;
    readonly PORT: number;
    readonly CORS_ORIGIN: string | undefined;
    readonly SUPABASE_URL: string;
    readonly SUPABASE_ANON_KEY: string;
    readonly SUPABASE_SERVICE_ROLE_KEY: string;
    readonly REDIS_URL: string;
    /** Used for AES-256-GCM encryption of vendor API keys (min 32 chars). */
    readonly API_KEY_SECRET: string;
    /** @deprecated Prefer API_KEY_SECRET for vendor keys. Kept for backward compatibility. */
    readonly ENCRYPTION_KEY: string | undefined;
    readonly AWS_REGION: string;
    readonly AWS_ACCESS_KEY_ID: string | undefined;
    readonly AWS_SECRET_ACCESS_KEY: string | undefined;
    readonly AWS_SECRETS_PREFIX: string;
    readonly LOG_LEVEL: string;
};
//# sourceMappingURL=env.d.ts.map