import { createContext, useContext } from 'react'
import type { BriefPageDto, BriefSource } from '../../lib/contracts'
import type { FeedbackItemType, FeedbackVerdict } from '../../lib/api/briefs'

export interface BriefViewContextValue {
  sources: Map<string, { n: number; source: BriefSource }>
  feedback: BriefPageDto['feedback']
  /** True when viewing an older version: no votes, no check-off. */
  readOnly: boolean
  pendingVotes: ReadonlySet<string>
  onVote: (itemType: FeedbackItemType, itemId: string, verdict: FeedbackVerdict) => void
}

export const BriefViewContext = createContext<BriefViewContextValue | null>(null)

export function useBriefView() {
  const value = useContext(BriefViewContext)
  if (!value) throw new Error('BriefViewContext is missing.')
  return value
}
