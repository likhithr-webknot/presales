import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // Storage
  STORAGE_ENDPOINT: z.string().min(1, 'STORAGE_ENDPOINT is required'),
  STORAGE_ACCESS_KEY: z.string().min(1, 'STORAGE_ACCESS_KEY is required'),
  STORAGE_SECRET_KEY: z.string().min(1, 'STORAGE_SECRET_KEY is required'),
  STORAGE_BUCKET_UPLOADS: z.string().default('presales-uploads'),
  STORAGE_BUCKET_ARTIFACTS: z.string().default('presales-artifacts'),
  STORAGE_BUCKET_TEMPLATES: z.string().default('presales-templates'),
  STORAGE_BUCKET_EXPORTS: z.string().default('presales-exports'),
  STORAGE_PRESIGNED_URL_TTL_HOURS: z.coerce.number().default(24),

  // Auth
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_CALLBACK_URL: z.string().min(1, 'GOOGLE_CALLBACK_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRY: z.string().default('7d'),
  ALLOWED_GOOGLE_DOMAINS: z.string().optional(),

  // AI Service (Python) — LLM logic lives here, NOT in Node
  AI_SERVICE_URL: z.string().min(1, 'AI_SERVICE_URL is required (e.g. http://ai-service:8000)'),
  AI_INTERNAL_SECRET: z.string().min(16, 'AI_INTERNAL_SECRET is required (min 16 chars)'),

  // Email
  EMAIL_SMTP_HOST: z.string().min(1, 'EMAIL_SMTP_HOST is required'),
  EMAIL_SMTP_PORT: z.coerce.number().default(587),
  EMAIL_SMTP_USER: z.string().min(1, 'EMAIL_SMTP_USER is required'),
  EMAIL_SMTP_PASS: z.string().min(1, 'EMAIL_SMTP_PASS is required'),
  EMAIL_FROM: z.string().min(1, 'EMAIL_FROM is required'),
  EMAIL_ENABLED: z.string().default('true').transform((v) => v === 'true'),

  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  FRONTEND_URL: z.string().min(1, 'FRONTEND_URL is required'),
  API_BASE_URL: z.string().min(1, 'API_BASE_URL is required'),

  // Feature config
  COMPLIANCE_VARIANCE_THRESHOLD: z.coerce.number().default(1.0),
  GATE_REMINDER_HOURS: z.coerce.number().default(24),
  MIN_REVIEWER_COUNT: z.coerce.number().default(1),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(50),
  LLM_OUTPUT_CACHE_TTL_SECONDS: z.coerce.number().default(3600),

  // Adapters
  MEETMINDS_ADAPTER: z.enum(['stub', 'real']).default('stub'),
  MEETMINDS_API_URL: z.string().optional(),
  MEETMINDS_API_KEY: z.string().optional(),
  PRICING_ADAPTER: z.enum(['stub', 'real']).default('stub'),
  PRICING_API_URL: z.string().optional(),
  PRICING_API_KEY: z.string().optional(),
  KB_ADAPTER: z.enum(['stub', 'real']).default('stub'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const missing = parsed.error.errors.map((e) => `  • ${e.path.join('.')}: ${e.message}`)
  console.error('\n❌ Missing or invalid environment variables:\n' + missing.join('\n'))
  console.error('\nCheck .env.example for the full list of required variables.\n')
  process.exit(1)
}

export const env = parsed.data
