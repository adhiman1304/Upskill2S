import { createContext, useContext } from 'react'
import type { BriefPageDto, BriefSource, FeedbackItemType, FeedbackReportReason } from '../../lib/contracts'

export interface BriefViewContextValue {
  sources: Map<string, { n: number; source: BriefSource }>
  feedback: BriefPageDto['feedback']
  /** True when viewing an older version: no star or report, no check-off. */
  readOnly: boolean
  pendingVotes: ReadonlySet<string>
  /** Toggles the user's star on an item. */
  onStar: (itemType: FeedbackItemType, itemId: string) => void
  /** Sends a report; resolves true when it was recorded. */
  onReport: (itemType: FeedbackItemType, itemId: string, reason: FeedbackReportReason, comment: string) => Promise<boolean>
}

export const BriefViewContext = createContext<BriefViewContextValue | null>(null)

export function useBriefView() {
  const value = useContext(BriefViewContext)
  if (!value) throw new Error('BriefViewContext is missing.')
  return value
}
