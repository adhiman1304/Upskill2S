import { LoaderCircle, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { StaleListDto } from '../../lib/api/adminOps'
import { formatDateTime } from './format'

export function StaleTable({ data, loading, onlyFollowed, onToggleFollowed, blockedReason, pendingIds, onRefresh }: { data: StaleListDto | null; loading: boolean; onlyFollowed: boolean; onToggleFollowed: (value: boolean) => void; blockedReason: string | null; pendingIds: Set<string>; onRefresh: (certificationId: string) => void }) {
  const items = data?.items ?? []
  return <section className="ops-card" aria-labelledby="ops-stale-heading">
    <div className="ops-card-head">
      <div><h2 id="ops-stale-heading">Stale certifications</h2><p className="muted">Current brief older than {data?.staleAfterDays ?? '…'} days, or followed with no brief. Certifications with an active job are hidden.</p></div>
      <label className="check"><input type="checkbox" checked={onlyFollowed} onChange={(event) => onToggleFollowed(event.target.checked)} /> Followed only</label>
    </div>
    {loading && !data ? <div className="loading-state ops-loading"><LoaderCircle className="spin" size={16} /> Loading stale certifications</div>
      : items.length === 0 ? <div className="empty-state ops-empty"><p>Nothing is stale.</p></div>
      : <div className="table-wrap"><table className="table ops-table">
        <thead><tr><th>Provider</th><th>Code</th><th>Title</th><th className="num">Followers</th><th>Brief age</th><th aria-label="Actions" /></tr></thead>
        <tbody>{items.map((item) => <tr key={item.certificationId}>
          <td>{item.provider}</td>
          <td><Link to={`/certifications/${item.certificationId}`}>{item.code}</Link></td>
          <td className="ops-cell-title">{item.title}</td>
          <td className="num">{item.followers}</td>
          <td>{item.reason === 'missing' ? <span className="chip is-missing">No brief</span> : <span title={formatDateTime(item.briefGeneratedAt)}>{item.briefAgeDays} days</span>}</td>
          <td className="ops-cell-actions"><button className="button button-secondary ops-small-button" disabled={Boolean(blockedReason) || pendingIds.has(item.certificationId)} title={blockedReason ?? 'Enqueue a refresh with the server key'} onClick={() => onRefresh(item.certificationId)}>{pendingIds.has(item.certificationId) ? <LoaderCircle className="spin" size={13} /> : <RefreshCw size={13} />} Refresh</button></td>
        </tr>)}</tbody>
      </table></div>}
  </section>
}
