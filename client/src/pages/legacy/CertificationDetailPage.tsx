import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, CalendarDays, FileText, LoaderCircle, Plus } from 'lucide-react'
import { getCertification, toggleBookmark, toggleHelpful } from '../../lib/api'
import type { Certification, Resource } from '../../lib/api'
import { useApi, useSession } from '../../session'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { CertificationDialog, ResourceCard, ResourceDetailDialog, ResourceDialog } from './components'
import { ProviderLogo } from './providers'
import './legacy.css'
import { formatDate, message } from './utils'

export function CertificationDetailPage() {
  const { id = '' } = useParams()
  return <CertificationDetail key={id} id={id} />
}

function CertificationDetail({ id }: { id: string }) {
  const request = useApi()
  const { userId, isAdmin } = useSession()
  const navigate = useNavigate()
  const onBack = () => navigate('/library')
  const [loaded, setLoaded] = useState<Certification | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeResource, setActiveResource] = useState<Resource | null>(null)
  const [editing, setEditing] = useState(false)
  const [addingResource, setAddingResource] = useState(false)
  useDocumentTitle(loaded ? `${loaded.code} resources` : 'Library')
  const refresh = useCallback(async () => { try { setLoaded(await getCertification(request, id)); setError('') } catch (reason) { setError(message(reason, 'Could not refresh certification.')) } }, [id, request])
  useEffect(() => {
    let active = true
    getCertification(request, id).then((data) => { if (active) { setLoaded(data); setError('') } }).catch((reason: unknown) => { if (active) setError(message(reason, 'Could not load certification resources.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, request])
  if (!loaded) return <div className="page-content detail-page"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> All certifications</button>{loading ? <div className="loading-state"><LoaderCircle className="spin" size={20} /> Loading certification</div> : <div className="alert error" role="alert">{error || 'Certification not found.'}</div>}</div>
  const item = loaded
  const setItem = (update: (current: Certification) => Certification) => setLoaded((current) => current ? update(current) : current)
  const canEdit = isAdmin || item.createdById === userId
  async function remove(resource: Resource) {
    if (!window.confirm(`Remove “${resource.title}” from this certification?`)) return
    try { await request(`/api/resources/${resource.id}`, { method: 'DELETE' }); await refresh() } catch (reason) { setError(message(reason, 'Could not remove resource.')) }
  }
  async function download(resource: Resource) {
    try { const blob = await request<Blob>(`/api/resources/${resource.id}/file`); const objectUrl = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = objectUrl; anchor.download = resource.title.endsWith('.pdf') ? resource.title : `${resource.title}.pdf`; anchor.click(); URL.revokeObjectURL(objectUrl) } catch (reason) { setError(message(reason, 'Could not download file.')) }
  }
  async function bookmark(resource: Resource) {
    try { const result = await toggleBookmark(request, resource.id); setItem((current) => ({ ...current, resources: current.resources.map((entry) => entry.id === resource.id ? { ...entry, isBookmarked: result.bookmarked } : entry) })) }
    catch (reason) { setError(message(reason, 'Could not update saved resources.')) }
  }
  async function helpful(resource: Resource) {
    try { const result = await toggleHelpful(request, resource.id); setItem((current) => ({ ...current, resources: current.resources.map((entry) => entry.id === resource.id ? { ...entry, isHelpful: result.helpful, helpfulCount: result.helpfulCount } : entry) })) }
    catch (reason) { setError(message(reason, 'Could not record feedback.')) }
  }
  return <div className="page-content detail-page"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> All certifications</button><header className="page-header detail-header"><div className="detail-title"><span className="provider-logo" aria-hidden="true"><ProviderLogo name={item.provider} /></span><div><p className="breadcrumb">{item.provider} <span>/</span> {item.code}</p><h1>{item.title}{item.status === 'RETIRED' && <span className="chip chip-warning">Retired</span>}</h1><p className="page-desc">{item.description || 'No description added yet.'}</p></div></div><div className="detail-actions">{canEdit && <button className="button button-secondary" onClick={() => setEditing(true)}>Edit details</button>}<button className="button button-primary" onClick={() => setAddingResource(true)}><Plus size={16} /> Add resource</button></div></header><div className="detail-meta"><span><BookOpen size={15} /> {item.code}</span>{item.examVersion && <span>Exam version {item.examVersion}</span>}{item.examUpdatedAt && <span><CalendarDays size={15} /> Exam updated {formatDate(item.examUpdatedAt)}</span>}<span><FileText size={15} /> {item.resources.length} resources</span></div>{item.topics.length > 0 && <div className="topic-list">{item.topics.map((topic) => <span className="topic-chip" key={topic}>{topic}</span>)}</div>}{error && <div className="alert error">{error}</div>}<section className="section resources-section"><div className="section-heading"><div><h2>Study resources</h2><p>Materials shared for this certification.</p></div></div>{item.resources.length ? <div className="resource-grid">{item.resources.map((resource) => <ResourceCard key={resource.id} resource={resource} canEdit={isAdmin || resource.createdById === userId} onOpen={() => setActiveResource(resource)} onDelete={() => void remove(resource)} onDownload={() => void download(resource)} onBookmark={() => void bookmark(resource)} onHelpful={() => void helpful(resource)} />)}</div> : <div className="empty-state"><FileText className="empty-icon" size={20} aria-hidden="true" /><h3>No resources yet</h3><p>Add the first question set, study note, link, or PDF.</p><button className="button button-secondary" onClick={() => setAddingResource(true)}><Plus size={16} /> Add resource</button></div>}</section>{activeResource && <ResourceDetailDialog resource={activeResource} onClose={() => setActiveResource(null)} onDownload={() => void download(activeResource)} onChanged={() => void refresh()} />}
    {editing && <CertificationDialog existing={item} onClose={() => setEditing(false)} onSaved={(saved) => { setLoaded(saved); setEditing(false); void refresh() }} />}
    {addingResource && <ResourceDialog certification={item} onClose={() => setAddingResource(false)} onSaved={() => { setAddingResource(false); void refresh() }} />}
  </div>
}
