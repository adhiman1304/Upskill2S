// Mirrors docs/AI_REWORK_PLAN.md section 5.2 (types only).
export interface OpenAiKeyStatusDto { configured: boolean; keyHint: string | null; lastValidatedAt: string | null; models: { research: string; fast: string }; serverKeyAvailable: boolean }
