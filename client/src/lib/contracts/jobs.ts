// Mirrors server/src/lib/contracts/jobs.ts (types only).
export type JobKind = 'BRIEF' | 'REFRESH' | 'INTAKE'
export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
export interface JobProgressEntry { at: string; message: string }
export interface JobDto { id: string; kind: JobKind; status: JobStatus; certificationId: string | null; intakeSessionId: string | null; resultBriefId: string | null; progress: JobProgressEntry[]; error: string | null; createdAt: string; startedAt: string | null; finishedAt: string | null }
