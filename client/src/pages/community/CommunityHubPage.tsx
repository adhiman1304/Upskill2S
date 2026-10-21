import { Bookmark, Library, MessagesSquare, Sparkles, Trophy } from 'lucide-react'
import { Tabs } from '../../components/ui/Tabs'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { LibraryPage } from '../legacy/LibraryPage'
import { SavedResourcesPage } from '../legacy/SavedResourcesPage'
import { CommunityPage } from '../legacy/CommunityPage'
import { ContributionsPage } from '../legacy/ContributionsPage'
import { LeaderboardPage } from '../legacy/LeaderboardPage'
import { useScopedParam } from './useScopedParam'

/** `/community`: the shared library and the other community pages as tabs (`?tab=`). The hub owns the only `h1` and the title. */
export function CommunityHubPage() {
  useDocumentTitle('Community')
  const mobile = useIsMobile()
  const icon = { size: 16, 'aria-hidden': true } as const
  useScopedParam('provider', 'library', 'library')
  return <div className="page-content hub-page">
    <header className="page-header"><div><h1>Community</h1><p className="page-desc">Shared library, saved resources, ideas and feedback, and recognition for contributors.</p></div></header>
    <Tabs mode="tabs" label="Community sections" className="hub-tabs" tabs={[
      { id: 'library', label: 'Library', icon: <Library {...icon} />, content: <LibraryPage embedded /> },
      { id: 'saved', label: 'Saved', icon: <Bookmark {...icon} />, content: <SavedResourcesPage embedded /> },
      { id: 'ideas', label: mobile ? 'Ideas' : 'Ideas & feedback', icon: <MessagesSquare {...icon} />, content: <CommunityPage embedded /> },
      { id: 'contributions', label: mobile ? 'Mine' : 'Contributions', icon: <Sparkles {...icon} />, content: <ContributionsPage embedded /> },
      { id: 'leaderboard', label: mobile ? 'Top' : 'Leaderboard', icon: <Trophy {...icon} />, content: <LeaderboardPage embedded /> },
    ]} />
  </div>
}
