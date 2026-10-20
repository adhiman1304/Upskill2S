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

export const config = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  tenantId,
  apiAudience,
  adminObjectIds: new Set((process.env.ADMIN_OBJECT_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean)),
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  uploadDirectory: resolve(process.cwd(), process.env.UPLOAD_DIR ?? './uploads'),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024),
}