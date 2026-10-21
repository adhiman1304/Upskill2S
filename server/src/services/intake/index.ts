// STUB owned by workstream C (intake and recommendations). S0 placeholder; replace wholesale.
import type { JobContext } from '../jobs/queue.js'

export async function runIntakeRecommendation(_ctx: JobContext): Promise<{ inputTokens: number; outputTokens: number }> {
  throw new Error('Intake recommendation not implemented yet (workstream C).')
}
