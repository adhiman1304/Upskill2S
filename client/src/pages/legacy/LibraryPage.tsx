import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, BookOpen, ChevronDown, FileText, LoaderCircle, Plus, Search, SlidersHorizontal, Tag } from 'lucide-react'
import type { Certification } from '../../lib/api'
import { useApi, useSession } from '../../session'
import { AdminReviewPanel } from './AdminReportsPage'
import { CertificationDialog } from './components'
import { ProviderLogo, featuredProviders, providerLogoDomains } from './providers'
import { formatDate, labels, message } from './utils'

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
  return <div className={`page-content ${provider ? 'provider-detail-page' : 'provider-home-page'}`}>
    <header className="topbar">
      {provider && <button className="back-link provider-back-link" onClick={backToProviders}><ArrowLeft size={16} /> All providers</button>}
      <div className="dashboard-heading"><p className="breadcrumb">LIBRARY {provider && <><span>/</span> {provider.toUpperCase()}</>}</p><h1>{provider || 'Certification providers'}</h1></div>
      <button className="button button-primary" onClick={onCreate}><Plus size={17} /> New certification</button>
    </header>
    {!provider ? <section className="provider-section provider-directory">
      <div className="section-heading"><div><h2>Browse by provider</h2><p>Select a provider to explore its certifications.</p></div><span className="result-count">{providerLoading ? 'Loading' : `${providerDirectory.length} providers`}</span></div>
      {providerError && <div className="alert error" role="alert">{providerError}</div>}
      {providerLoading ? <div className="loading-state"><LoaderCircle className="spin" size={20} /> Loading providers</div> : <div className="provider-grid">{providerDirectory.map((item) => <button type="button" className="provider-card" key={item.name} onClick={() => openProvider(item.filterName)}><span className="provider-logo"><ProviderLogo name={item.name} domain={item.domain} /></span><strong className="provider-card-title">{item.name}</strong>{item.detail && <span className="provider-card-detail">{item.detail}</span>}<span className="provider-card-count"><b>{item.certifications}</b><small>{item.certifications === 1 ? 'certification' : 'certifications'}</small></span></button>)}</div>}
    </section> : <>
      <section className="provider-detail-banner"><span className="provider-logo"><ProviderLogo name={provider} /></span><div><p className="eyebrow">PROVIDER</p><h2>{provider}</h2></div><span className="provider-detail-count"><strong>{selectedProvider?.certifications ?? 0}</strong><small>{selectedProvider?.certifications === 1 ? 'certification' : 'certifications'}</small></span></section>
      <section className="library-section"><div className="section-heading"><div><h2>Certifications</h2><p>Choose a certification to view its study resources.</p></div><span className="result-count">{loading ? 'Loading' : `${items.length} certifications`}</span></div>
        <div className="filter-bar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search certifications and resources" aria-label="Search certifications and resources" /></label><label className="select-field"><Tag size={16} /><select value={topic} onChange={(event) => setTopic(event.target.value)} aria-label="Filter by topic"><option value="">All topics</option>{topics.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={15} /></label><label className="select-field"><SlidersHorizontal size={16} /><select value={resourceType} onChange={(event) => setResourceType(event.target.value)} aria-label="Filter by resource type"><option value="">All formats</option>{Object.entries(labels).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select><ChevronDown size={15} /></label><label className="select-field"><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by certification status"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="RETIRED">Retired</option></select><ChevronDown size={15} /></label></div>
        {error && <div className="alert error" role="alert">{error}</div>}{loading ? <div className="loading-state"><LoaderCircle className="spin" size={21} /> Loading certifications</div> : items.length ? <div className="cert-list"><div className="cert-list-header"><span>CERTIFICATION</span><span>PROVIDER</span><span>RESOURCES</span><span>UPDATED</span></div>{items.map((item, index) => <button className="cert-row" key={item.id} onClick={() => onOpen(item)} style={{ animationDelay: `${index * 35}ms` }}><span className="cert-title"><span className={`provider-glyph glyph-${index % 4}`}>{item.provider.slice(0, 1).toUpperCase()}</span><span><strong>{item.title}{item.status === 'RETIRED' && <span className="status-label retired">Retired</span>}</strong><small>{item.code}{item.examVersion ? ` · ${item.examVersion}` : ''}</small></span></span><span className="provider-name">{item.provider}</span><span className="resource-count"><FileText size={15} /> {item.resourceCount} <small>{item.resourceCount === 1 ? 'resource' : 'resources'}</small></span><span className="updated-time">{formatDate(item.updatedAt)}</span><ArrowUpRight className="row-arrow" size={17} /></button>)}</div> : <div className="empty-state"><div className="empty-icon"><BookOpen size={22} /></div><h3>{search || resourceType || topic || status ? 'No matching certifications' : 'No certifications yet'}</h3><p>{search || resourceType || topic || status ? 'Try a different search or clear a filter.' : `Add the first ${provider} certification to this library.`}</p>{!search && !resourceType && !topic && !status && <button className="button button-secondary" onClick={onCreate}><Plus size={16} /> Create certification</button>}</div>}</section>
      {isAdmin && <AdminReviewPanel />}
    </>}
    <footer className="page-footer"><span>UPSKILL <span className="brand-period">•</span> COMPANY LEARNING</span><span>Resources are contributed by your team</span></footer>
    {creating && <CertificationDialog onClose={() => setCreating(false)} onSaved={(item) => { setCreating(false); onOpen(item) }} />}
  </div>
}
