// STUB owned by workstream A (research pipeline). S0 placeholder; replace wholesale.
import type { JobContext } from '../jobs/queue.js'

export async function runBriefResearch(_ctx: JobContext): Promise<{ briefId: string; inputTokens: number; outputTokens: number }> {
  throw new Error('Research pipeline not implemented yet (workstream A).')
}
