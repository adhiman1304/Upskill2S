import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bookmark, LoaderCircle } from 'lucide-react'
import { getBookmarks, toggleBookmark, toggleHelpful } from '../../lib/api'
import type { Resource } from '../../lib/api'
import { useApi } from '../../session'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import './legacy.css'
import { PageFrame, PageHeading } from './embed'
import { ResourceCard, ResourceDetailDialog } from './components'
import { message } from './utils'

export function SavedResourcesPage({ embedded = false }: { embedded?: boolean }) {
  useDocumentTitle('Saved resources', !embedded)
  const request = useApi()
  const navigate = useNavigate()
  const onBack = () => navigate('/community?tab=library')
  const [items, setItems] = useState<Resource[]>([])
  const [active, setActive] = useState<Resource | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    try { setItems(await getBookmarks(request)); setError('') }
    catch (reason) { setError(message(reason, 'Could not load saved resources.')) }
    finally { setLoading(false) }
  }, [request])
  useEffect(() => {
    let active = true
    getBookmarks(request).then((data) => { if (active) { setItems(data); setError('') } }).catch((reason: unknown) => { if (active) setError(message(reason, 'Could not load saved resources.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request])
  async function download(resource: Resource) {
    try { const blob = await request<Blob>(`/api/resources/${resource.id}/file`); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = resource.originalFileName ?? `${resource.title}.pdf`; anchor.click(); URL.revokeObjectURL(url) }
    catch (reason) { setError(message(reason, 'Could not download file.')) }
  }
  async function removeBookmark(resource: Resource) {
    try { await toggleBookmark(request, resource.id); setItems((current) => current.filter((item) => item.id !== resource.id)); setActive(null) }
    catch (reason) { setError(message(reason, 'Could not update saved resources.')) }
  }
  async function helpful(resource: Resource) {
    try { const result = await toggleHelpful(request, resource.id); setItems((current) => current.map((item) => item.id === resource.id ? { ...item, isHelpful: result.helpful, helpfulCount: result.helpfulCount } : item)) }
    catch (reason) { setError(message(reason, 'Could not record feedback.')) }
  }
  return <PageFrame embedded={embedded}>{!embedded && <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Certification library</button>}<PageHeading embedded={embedded} title="Saved resources" description="Material you saved from the community library." />{error && <div className="alert error">{error}</div>}{loading ? <div className="loading-state"><LoaderCircle className="spin" size={20} /> Loading saved resources</div> : items.length ? <div className="resource-grid">{items.map((resource) => <div key={resource.id}><p className="saved-certification">{resource.certification?.provider} · {resource.certification?.code}</p><ResourceCard resource={resource} canEdit={false} onOpen={() => setActive(resource)} onDelete={() => {}} onDownload={() => void download(resource)} onBookmark={() => void removeBookmark(resource)} onHelpful={() => void helpful(resource)} /></div>)}</div> : <div className="empty-state"><Bookmark className="empty-icon" size={20} aria-hidden="true" /><h3>No saved resources</h3><p>Save useful material from a resource detail view to find it here later.</p></div>}{active && <ResourceDetailDialog resource={active} onClose={() => setActive(null)} onDownload={() => void download(active)} onChanged={() => void refresh()} />}</PageFrame>
}
