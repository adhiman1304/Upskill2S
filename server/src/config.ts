import 'dotenv/config'
import { resolve } from 'node:path'

export const localAuthBypass = process.env.DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production'
export const tenantId = process.env.TENANT_ID?.trim() ?? ''
export const apiAudience = process.env.API_AUDIENCE?.trim() ?? ''

if (!localAuthBypass && (!tenantId || !apiAudience)) {
  throw new Error('TENANT_ID and API_AUDIENCE are required unless local development auth bypass is enabled.')
}

if (process.env.NODE_ENV === 'production' && process.env.DEV_AUTH_BYPASS === 'true') {
  throw new Error('DEV_AUTH_BYPASS cannot be enabled in production.')
}

function positiveInt(name: string, fallback: number) {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`)
  return value
}

function resolveKeyEncryptionSecret() {
  const secret = process.env.KEY_ENCRYPTION_SECRET?.trim() ?? ''
  if (secret) {
    if (secret.length < 32 && !localAuthBypass) throw new Error('KEY_ENCRYPTION_SECRET must be at least 32 characters.')
    return secret
  }
  if (!localAuthBypass) throw new Error('KEY_ENCRYPTION_SECRET is required unless local development auth bypass is enabled.')
  console.warn('KEY_ENCRYPTION_SECRET is not set; using a deterministic development-only fallback. Never use this outside local development.')
  return 'upskill-local-development-only-key-encryption-secret'
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  tenantId,
  apiAudience,
  adminObjectIds: new Set((process.env.ADMIN_OBJECT_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean)),
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  uploadDirectory: resolve(process.cwd(), process.env.UPLOAD_DIR ?? './uploads'),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024),
  keyEncryptionSecret: resolveKeyEncryptionSecret(),
  openAiResearchModel: process.env.OPENAI_RESEARCH_MODEL?.trim() || 'gpt-5',
  openAiFastModel: process.env.OPENAI_FAST_MODEL?.trim() || 'gpt-5-mini',
  openAiServerApiKey: process.env.OPENAI_SERVER_API_KEY?.trim() || null,
  researchMaxWebSearches: positiveInt('RESEARCH_MAX_WEB_SEARCHES', 16),
  briefStaleDays: positiveInt('BRIEF_STALE_DAYS', 30),
  blockedResearchDomains: (process.env.BLOCKED_RESEARCH_DOMAINS ?? 'examtopics.com,braindumps.com,dumpsbase.com,pass4sure.com,exam-labs.com,itexams.com,certlibrary.com')
    .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean),
  schedulerEnabled: process.env.SCHEDULER_ENABLED === 'true',
  schedulerCron: process.env.SCHEDULER_CRON?.trim() || '0 3 * * *',
  intakeMaxFiles: positiveInt('INTAKE_MAX_FILES', 3),
  intakeMaxFileBytes: positiveInt('INTAKE_MAX_FILE_BYTES', 10 * 1024 * 1024),
}