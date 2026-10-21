import { z } from 'zod'

export const openAiKeyStatusDtoSchema = z.object({
  configured: z.boolean(),
  keyHint: z.string().nullable(),
  lastValidatedAt: z.string().nullable(),
  models: z.object({ research: z.string(), fast: z.string() }),
  serverKeyAvailable: z.boolean(),
})
export type OpenAiKeyStatusDto = z.infer<typeof openAiKeyStatusDtoSchema>

/** Body of PUT /api/settings/openai-key. */
export const saveOpenAiKeySchema = z.object({
  apiKey: z.string().trim().min(20).max(400).startsWith('sk-'),
})
export type SaveOpenAiKeyInput = z.infer<typeof saveOpenAiKeySchema>
