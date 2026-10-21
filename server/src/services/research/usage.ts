import type OpenAI from 'openai'

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export const emptyUsage = (): TokenUsage => ({ inputTokens: 0, outputTokens: 0 })

export function usageOf(response: Pick<OpenAI.Responses.Response, 'usage'>): TokenUsage {
  return { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 }
}

export function addUsage(total: TokenUsage, next: TokenUsage): TokenUsage {
  return { inputTokens: total.inputTokens + next.inputTokens, outputTokens: total.outputTokens + next.outputTokens }
}
