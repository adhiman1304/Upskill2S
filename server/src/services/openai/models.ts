import { config } from '../../config.js'

/** Model names come from env (OPENAI_RESEARCH_MODEL / OPENAI_FAST_MODEL). */
export const openAiModels: { research: string; fast: string } = {
  research: config.openAiResearchModel,
  fast: config.openAiFastModel,
}
