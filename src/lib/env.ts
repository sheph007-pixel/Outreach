import { z } from 'zod'

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  AZURE_AD_CLIENT_ID: z.string().min(1),
  AZURE_AD_CLIENT_SECRET: z.string().min(1),
  AZURE_AD_TENANT_ID: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().default(30000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type ServerEnv = z.infer<typeof serverSchema>

let _env: ServerEnv | null = null

export function getEnv(): ServerEnv {
  if (_env) return _env
  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment variables')
  }
  _env = parsed.data
  return _env
}
