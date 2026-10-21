import { Activity, Flag } from 'lucide-react'
import { Tabs } from '../../components/ui/Tabs'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { AdminReportsPage } from '../legacy/AdminReportsPage'
import { useScopedParam } from '../community/useScopedParam'
import { AdminOpsPage } from './AdminOpsPage'

/** `/admin`: Operations and the review queue as tabs (`?tab=`). Wrapped in `RequireAdmin`; the API enforces admin access. */
export function AdminHubPage() {
  useDocumentTitle('Admin')
  const mobile = useIsMobile()
  const icon = { size: 16, 'aria-hidden': true } as const
  useScopedParam('section', 'operations', 'operations')
  return <div className="page-content hub-page">
    <header className="page-header"><div><h1>Admin</h1><p className="page-desc">Research operations and the review queue for shared resources.</p></div></header>
    <Tabs mode="tabs" label="Admin sections" className="hub-tabs" tabs={[
      { id: 'operations', label: 'Operations', icon: <Activity {...icon} />, content: <AdminOpsPage embedded /> },
      { id: 'review', label: mobile ? 'Review' : 'Review queue', icon: <Flag {...icon} />, content: <AdminReportsPage embedded /> },
    ]} />
  </div>
}
