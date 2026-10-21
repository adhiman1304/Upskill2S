// Client mirrors of the server contracts (docs/AI_REWORK_PLAN.md section 5). Types only, no runtime code.
export type * from './brief'
export type * from './jobs'
export type * from './intake'
export type * from './settings'
export type * from './catalog'

/** Machine-readable error codes returned as `{ error, code }` by the new API routes (plan section 5.3). */
export type ApiErrorCode = 'OPENAI_KEY_MISSING' | 'OPENAI_KEY_INVALID' | 'JOB_ALREADY_RUNNING' | 'RATE_LIMITED' | 'NOT_IMPLEMENTED'
