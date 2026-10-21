// SAMPLE DATA (development only). Builds a BriefPageDto around the DP-700 fixture brief for `?fixture=1`.
import type { BriefPageDto } from '../../../lib/contracts'
import type { BriefVersionSummary } from '../../../lib/contracts'
import { dp700SampleBrief } from './dp-700.sample'

const generatedAt = '2026-10-18T09:45:00.000Z'

export function fixtureBriefPage(certificationId: string): BriefPageDto {
  const content = dp700SampleBrief
  return {
    certification: { id: certificationId, provider: content.certification.provider, code: content.certification.code, title: content.certification.title, officialUrl: content.certification.officialUrl, status: 'ACTIVE' },
    brief: { id: 'fixture-dp-700-v3', certificationId, version: 3, status: 'CURRENT', model: 'sample-fixture', sourceCount: content.sources.length, generatedAt, content },
    freshness: { status: 'fresh', generatedAt, staleAfterDays: 30, ageDays: 3 },
    activeJob: null,
    progress: { completedItemIds: ['read-the-study-guide', 'take-baseline-practice-assessment', 'start-fabric-trial'] },
    feedback: {
      'gap:kql-and-real-time-intelligence': { accurate: 7, inaccurate: 0, outdated: 1, mine: null },
      'gap:preview-features': { accurate: 1, inaccurate: 2, outdated: 0, mine: null },
      'checklist:read-the-study-guide': { accurate: 4, inaccurate: 0, outdated: 0, mine: 'accurate' },
      'skill:ingest-and-transform-data': { accurate: 3, inaccurate: 0, outdated: 1, mine: null },
    },
    following: { status: 'STUDYING', targetDate: '2026-12-15' },
  }
}

export function fixtureVersions(certificationId: string): BriefVersionSummary[] {
  void certificationId
  return [
    { id: 'fixture-dp-700-v3', version: 3, status: 'CURRENT', model: 'sample-fixture', sourceCount: dp700SampleBrief.sources.length, generatedAt },
    { id: 'fixture-dp-700-v2', version: 2, status: 'SUPERSEDED', model: 'sample-fixture', sourceCount: 6, generatedAt: '2026-08-30T08:00:00.000Z' },
  ]
}
