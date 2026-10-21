import { runIntakeRecommendation } from '../intake/index.js'
import { runBriefResearch } from '../research/index.js'
import { registerJobHandler, type JobHandler } from './queue.js'

const briefHandler: JobHandler = async (ctx) => {
  const result = await runBriefResearch(ctx)
  return { resultBriefId: result.briefId, inputTokens: result.inputTokens, outputTokens: result.outputTokens }
}

export function registerHandlers(): void {
  registerJobHandler('BRIEF', briefHandler)
  registerJobHandler('REFRESH', briefHandler)
  registerJobHandler('INTAKE', async (ctx) => runIntakeRecommendation(ctx))
}
