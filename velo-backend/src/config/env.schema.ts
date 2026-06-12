import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  STELLAR_NETWORK: z.enum(['testnet', 'mainnet']),
  STELLAR_HORIZON_URL: z.string().url(),
  STELLAR_TREASURY_PUBLIC_KEY: z.string(),
  USDC_ASSET_CODE: z.string().default('USDC'),
  USDC_ASSET_ISSUER: z.string(),
  AWS_KMS_KEY_ID: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  TRM_LABS_API_KEY: z.string().optional(),
  OFAC_SCREENING_ENABLED: z.string().transform(v => v === 'true').default('false'),
  CORS_ORIGINS: z.string(),
  APP_URL: z.string().url(),
  PAY_URL: z.string().url(),
  SENTRY_DSN: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().optional(),
  RUN_MIGRATIONS_ON_STARTUP: z.string().transform(v => v === 'true').default('false'),
  POSTMARK_API_TOKEN: z.string().optional(),
  PORT: z.string().transform(Number).default('3001'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default('velo-backend'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${result.error.message}`);
  }
  return result.data;
}
