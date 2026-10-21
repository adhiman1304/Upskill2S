import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, LoaderCircle, Plus } from 'lucide-react'
import type { Certification } from '../../lib/api'
import { useApi, useSession } from '../../session'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { AdminReviewPanel } from './AdminReportsPage'
import { CertificationDialog } from './components'
import { ProviderLogo, featuredProviders, providerLogoDomains } from './providers'
import { formatDate, labels, message } from './utils'
import './legacy.css'

export function LibraryPage() {
  const request = useApi()
  const { isAdmin } = useSession()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const onOpen = (item: Certification) => navigate(`/library/${encodeURIComponent(item.id)}`)
  const onCreate = () => setCreating(true)
  const [listResult, setListResult] = useState<{ key: string; items: Certification[]; error: string }>({ key: '', items: [], error: '' })
  const [providerItems, setProviderItems] = useState<Certification[]>([])
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('')
  const [resourceType, setResourceType] = useState('')
  const [topic, setTopic] = useState('')
  const [status, setStatus] = useState('')
  const [providerLoading, setProviderLoading] = useState(true)
  const [providerError, setProviderError] = useState('')
  const listQuery = new URLSearchParams()
  if (provider) listQuery.set('provider', provider)
  if (search.trim()) listQuery.set('search', search.trim())
  if (resourceType) listQuery.set('resourceType', resourceType)
  if (topic) listQuery.set('topic', topic)
  if (status) listQuery.set('status', status)
  const listKey = provider ? listQuery.toString() : ''
  const items = listResult.key === listKey ? listResult.items : []
  const error = listResult.key === listKey ? listResult.error : ''
  const loading = Boolean(provider) && listResult.key !== listKey
  useEffect(() => {
    let active = true
    request<Certification[]>('/api/certifications').then((data) => { if (active) { setProviderItems(data); setProviderError('') } }).catch((reason: unknown) => { if (active) setProviderError(message(reason, 'Could not load providers.')) }).finally(() => { if (active) setProviderLoading(false) })
    return () => { active = false }
  }, [request])
  useEffect(() => {
    if (!provider) return
    let active = true
    request<Certification[]>(`/api/certifications?${listKey}`).then((data) => { if (active) setListResult({ key: listKey, items: data, error: '' }) }).catch((reason: unknown) => { if (active) setListResult({ key: listKey, items: [], error: message(reason, 'Could not load certifications. Check that the API is running.') }) })
    return () => { active = false }
  }, [listKey, provider, request])
  const providerStats = useMemo(() => {
    const grouped = new Map<string, { certifications: number; resources: number }>()
    for (const item of providerItems) {
      const counts = grouped.get(item.provider) ?? { certifications: 0, resources: 0 }
      counts.certifications += 1
      counts.resources += item.resourceCount
      grouped.set(item.provider, counts)
    }
    return [...grouped].map(([name, counts]) => ({ name, ...counts })).sort((a, b) => a.name.localeCompare(b.name))
  }, [providerItems])
  const providerDirectory = useMemo(() => {
    const stats = new Map(providerStats.map((item) => [item.name.toLowerCase(), item]))
    const featuredNames = new Set(featuredProviders.map((item) => item.name.toLowerCase()))
    const featured = featuredProviders.map((item) => {
      const match = stats.get(item.name.toLowerCase())
      return { ...item, detail: item.detail ?? '', filterName: match?.name ?? item.name, certifications: match?.certifications ?? 0 }
    })
    const additional = providerStats.filter((item) => !featuredNames.has(item.name.toLowerCase())).map((item) => ({ ...item, detail: '', filterName: item.name, domain: providerLogoDomains[item.name.toLowerCase()] }))
    const relevance = new Map(featuredProviders.map((item, index) => [item.name.toLowerCase(), index]))
    return [...featured, ...additional].sort((a, b) => b.certifications - a.certifications || (relevance.get(a.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER) - (relevance.get(b.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name))
  }, [providerStats])
  const topics = useMemo(() => [...new Set(items.flatMap((item) => item.topics))].sort(), [items])
  function openProvider(name: string) {
    setSearch('')
    setResourceType('')
    setTopic('')
    setStatus('')
    setProvider(name)
  }
  function backToProviders() {
    setProvider('')
    setSearch('')
    setResourceType('')
    setTopic('')
    setStatus('')
  }
  const selectedProvider = providerStats.find((item) => item.name === provider)
  useDocumentTitle(provider ? `Library: ${provider}` : 'Library')
  return <div className="page-content library-page">
    {provider && <button className="back-link" onClick={backToProviders}><ArrowLeft size={16} /> All providers</button>}
    <header className="page-header">
      <div><h1>{provider || 'Community library'}</h1><p className="page-desc">{provider ? `${selectedProvider?.certifications ?? 0} ${selectedProvider?.certifications === 1 ? 'certification' : 'certifications'}. Choose one to view its study resources.` : 'Notes, question sets and links shared by colleagues, by provider.'}</p></div>
      <button className="button button-primary" onClick={onCreate}><Plus size={16} /> New certification</button>
    </header>
    {!provider ? <section className="provider-directory" aria-label="Providers">
      <div className="section-heading"><div><h2>Providers</h2></div><span className="result-count">{providerLoading ? 'Loading' : `${providerDirectory.length} providers`}</span></div>
      {providerError && <div className="alert error" role="alert">{providerError}</div>}
      {providerLoading ? <div className="loading-state"><LoaderCircle className="spin" size={20} /> Loading providers</div> : <div className="provider-grid">{providerDirectory.map((item) => <button type="button" className="provider-card" key={item.name} aria-label={`${item.name}, ${item.certifications} ${item.certifications === 1 ? 'certification' : 'certifications'}`} onClick={() => openProvider(item.filterName)}><span className="provider-logo"><ProviderLogo name={item.name} domain={item.domain} /></span><span className="provider-card-text"><strong>{item.name}</strong><small>{item.certifications} {item.certifications === 1 ? 'certification' : 'certifications'}</small></span></button>)}</div>}
    </section> : <>
      <section className="library-section" aria-label="Certifications">
        <div className="filter-bar"><input type="search" className="filter-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search certifications and resources" aria-label="Search certifications and resources" /><select value={topic} onChange={(event) => setTopic(event.target.value)} aria-label="Filter by topic"><option value="">All topics</option>{topics.map((name) => <option key={name}>{name}</option>)}</select><select value={resourceType} onChange={(event) => setResourceType(event.target.value)} aria-label="Filter by resource type"><option value="">All formats</option>{Object.entries(labels).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by certification status"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="RETIRED">Retired</option></select></div>
        <p className="result-count filter-count" aria-live="polite">{loading ? 'Loading' : `${items.length} ${items.length === 1 ? 'certification' : 'certifications'}`}</p>
        {error && <div className="alert error" role="alert">{error}</div>}{loading ? <div className="loading-state"><LoaderCircle className="spin" size={21} /> Loading certifications</div> : items.length ? <div className="cert-list"><div className="cert-list-header" aria-hidden="true"><span>Certification</span><span>Resources</span><span>Updated</span></div>{items.map((item) => <button className="cert-row" key={item.id} onClick={() => onOpen(item)}><span className="cert-title"><strong>{item.title}{item.status === 'RETIRED' && <span className="chip chip-warning">Retired</span>}</strong><small>{item.code}{item.examVersion ? ` · ${item.examVersion}` : ''}</small></span><span className="resource-count">{item.resourceCount} {item.resourceCount === 1 ? 'resource' : 'resources'}</span><span className="updated-time">{formatDate(item.updatedAt)}</span></button>)}</div> : <div className="empty-state"><BookOpen className="empty-icon" size={20} aria-hidden="true" /><h3>{search || resourceType || topic || status ? 'No matching certifications' : 'No certifications yet'}</h3><p>{search || resourceType || topic || status ? 'Try a different search or clear a filter.' : `Add the first ${provider} certification to this library.`}</p>{!search && !resourceType && !topic && !status && <button className="button button-secondary" onClick={onCreate}><Plus size={16} /> Create certification</button>}</div>}</section>
      {isAdmin && <AdminReviewPanel />}
    </>}
    {creating && <CertificationDialog onClose={() => setCreating(false)} onSaved={(item) => { setCreating(false); onOpen(item) }} />}
  </div>
}
