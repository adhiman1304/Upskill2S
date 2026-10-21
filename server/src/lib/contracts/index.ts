export * from './brief.js'
export * from './catalog.js'
export * from './intake.js'
export * from './jobs.js'
export * from './settings.js'

/** Error body convention for new routes (plan section 5.3). */
export type ApiErrorCode = 'OPENAI_KEY_MISSING' | 'OPENAI_KEY_INVALID' | 'JOB_ALREADY_RUNNING' | 'RATE_LIMITED' | 'NOT_IMPLEMENTED'
export interface ApiErrorBody { error: string; code?: ApiErrorCode }
