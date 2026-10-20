import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { MsalProvider, useIsAuthenticated, useMsal } from '@azure/msal-react'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import DOMPurify from 'dompurify'
import { ArrowDownToLine, ArrowLeft, ArrowUpRight, BadgeCheck, Bookmark, BookOpen, CalendarDays, Check, ChevronDown, CircleHelp, Eye, EyeOff, FileText, Flag, GraduationCap, Link2, LoaderCircle, LogOut, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Tag, ThumbsUp, Trash2, Upload, XCircle } from 'lucide-react'
import { RichTextEditor } from './components/RichTextEditor'
import { devAuthBypass, msalInstance, msalScopes, msalSetupComplete } from './auth'
import { ApiError, apiRequest, getBookmarks, getOpenReports, moderateResource, reportResource, resolveReport, toggleBookmark, toggleHelpful } from './lib/api'
import type { Certification, CertificationInput, Resource, ResourceInput, ResourceKind, ResourceReport } from './lib/api'
import './Portal.css'
import './ProviderDirectory.css'
import './Features.css'

const labels: Record<ResourceKind, string> = { QUESTION_SET: 'Question set', RICH_TEXT: 'Study notes', LINK: 'Link', PDF: 'PDF' }
type Requester = <T>(path: string, init?: RequestInit) => Promise<T>
interface PortalSession { authenticated: boolean; userId: string; displayName: string; isAdmin: boolean; isLocal: boolean; request: Requester; signIn: () => Promise<void>; signOut: () => Promise<void> }
const SessionContext = createContext<PortalSession | null>(null)
const localSession: PortalSession = { authenticated: true, userId: 'local-developer', displayName: 'Local Developer', isAdmin: import.meta.env.VITE_LOCAL_IS_ADMIN === 'true', isLocal: true, request: apiRequest, signIn: async () => {}, signOut: async () => {} }

export default function Portal() {
  if (devAuthBypass) return <SessionContext.Provider value={localSession}><AuthenticatedPortal /></SessionContext.Provider>
  if (!msalSetupComplete || !msalInstance) return <SetupScreen />
  return <MsalProvider instance={msalInstance}><EntraSessionProvider><AuthenticatedPortal /></EntraSessionProvider></MsalProvider>
}

function EntraSessionProvider({ children }: { children: ReactNode }) {
  const authenticated = useIsAuthenticated()
  const { instance, accounts } = useMsal()
  const account = accounts[0]
  const claims = account?.idTokenClaims as { oid?: string; roles?: string[] } | undefined
  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    if (!account) throw new Error('Sign in to continue.')
    const headers = new Headers(init?.headers)
    try { const token = await instance.acquireTokenSilent({ scopes: msalScopes, account }); headers.set('Authorization', `Bearer ${token.accessToken}`) }
    catch (error) {
      if (!(error instanceof InteractionRequiredAuthError)) throw error
      const token = await instance.acquireTokenPopup({ scopes: msalScopes, account }); headers.set('Authorization', `Bearer ${token.accessToken}`)
    }
    return apiRequest<T>(path, { ...init, headers })
  }, [account, instance])
  const session: PortalSession = {
    authenticated,
    userId: claims?.oid ?? '',
    displayName: account?.name ?? 'Company account',
    isAdmin: claims?.roles?.includes('Upskill.Admin') ?? false,
    isLocal: false,
    request,
    signIn: async () => { await instance.loginPopup({ scopes: msalScopes }) },
    signOut: async () => { await instance.logoutPopup({ account }) },
  }
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

function SetupScreen() {
  return <main className="setup-screen"><section className="setup-panel"><Brand /><div className="setup-icon"><ShieldCheck size={24} /></div><p className="eyebrow">WORKSPACE SETUP</p><h1>Connect your company account</h1><p className="setup-copy">Configure Microsoft Entra ID to enable company sign-in. Add the tenant, app, and API scope values to <code>client/.env</code>.</p><div className="setup-code"><code>VITE_ENTRA_TENANT_ID</code><code>VITE_ENTRA_CLIENT_ID</code><code>VITE_ENTRA_API_SCOPE</code></div><p className="setup-footnote">See README.md for local app registration and API setup.</p></section></main>
}

function AuthenticatedPortal() {
  const session = useSession()
  const [signInError, setSignInError] = useState('')
  const [selected, setSelected] = useState<Certification | null>(null)
  const [editing, setEditing] = useState<Certification | null>(null)
  const [addingResource, setAddingResource] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [refresh, setRefresh] = useState(0)

  async function signIn() {
    setSignInError('')
    try { await session.signIn() }
    catch { setSignInError('Sign-in did not complete. Check your company account and app registration.') }
  }
  if (!session.authenticated) return <LoginScreen onSignIn={() => void signIn()} error={signInError} />

  function openCertification(certification: Certification) { setSelected(certification); setEditing(null); setAddingResource(false); setSavedOpen(false) }
  function returnToList() { setSelected(null); setEditing(null); setAddingResource(false); setSavedOpen(false) }
  function done() { setEditing(null); setAddingResource(false); setRefresh((value) => value + 1) }
  function openSaved() { setSelected(null); setEditing(null); setAddingResource(false); setSavedOpen(true) }

  return <div className="app-shell"><aside className="sidebar"><Brand /><div className="sidebar-section-label">LIBRARY</div><button className={`nav-link ${!selected && !savedOpen ? 'active' : ''}`} onClick={returnToList}><BookOpen size={17} /> Browse certifications</button><button className={`nav-link ${savedOpen ? 'active' : ''}`} onClick={openSaved}><Bookmark size={17} /> Saved resources</button><div className="sidebar-bottom"><div className="sidebar-note"><Sparkles size={15} /><span>{session.isLocal ? 'Local development mode' : 'Build your next skill path'}</span></div><button className="account-button" onClick={() => void session.signOut()}><span className="avatar">{session.displayName.slice(0, 1).toUpperCase()}</span><span className="account-details"><strong>{session.displayName}</strong><small>{session.isLocal ? 'Authentication disabled' : 'Signed in'}</small></span><LogOut size={15} /></button></div></aside>
    <main className="main-area">{selected ? <DetailView key={`${selected.id}-${refresh}`} certification={selected} userId={session.userId} isAdmin={session.isAdmin} onBack={returnToList} onEdit={() => setEditing(selected)} onAddResource={() => setAddingResource(true)} onChanged={done} /> : savedOpen ? <SavedResources onBack={returnToList} /> : <Dashboard key={refresh} isAdmin={session.isAdmin} onOpen={openCertification} onCreate={() => setEditing({ id: '', provider: '', code: '', title: '', description: '', status: 'ACTIVE', examVersion: null, examUpdatedAt: null, topics: [], createdById: session.userId, createdByName: session.displayName, resources: [], resourceCount: 0, updatedAt: '' })} />}</main>
    {editing && <CertificationDialog existing={editing.id ? editing : undefined} onClose={() => setEditing(null)} onSaved={(item) => { setSelected(item); done() }} />}
    {addingResource && selected && <ResourceDialog certification={selected} onClose={() => setAddingResource(false)} onSaved={done} />}
  </div>
}

function Brand() { return <div className="brand"><span className="brand-icon"><GraduationCap size={20} /></span><span>upskill<span className="brand-period">.</span></span></div> }

function LoginScreen({ onSignIn, error }: { onSignIn: () => void; error: string }) {
  return <main className="login-screen"><section className="login-copy"><Brand /><div className="login-message"><p className="eyebrow">YOUR CERTIFICATION LIBRARY</p><h1>Make learning<br /><span>move forward.</span></h1><p>One shared place for certification paths, questions, notes, and trusted resources.</p></div><p className="login-bottom">A company learning resource</p></section><section className="login-form-panel"><div className="login-form-wrap"><div className="login-mark"><GraduationCap size={26} /></div><p className="eyebrow">WELCOME TO UPSKILL</p><h2>Sign in to continue</h2><p className="muted">Use your company Microsoft account to open the certification library.</p>{error && <div className="alert error" role="alert">{error}</div>}<button className="button button-primary sign-in-button" onClick={onSignIn}>Sign in with Microsoft <ArrowUpRight size={16} /></button><p className="sign-in-note"><ShieldCheck size={14} /> Company account required</p></div><span className="login-version">UPSKILL <span>•</span> INTERNAL LEARNING</span></section></main>
}

function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('Upskill session context is unavailable.')
  return session
}

function useApi() { return useSession().request }

const featuredProviders = [
  { name: 'Microsoft', domain: 'microsoft.com' },
  { name: 'Anthropic', domain: 'anthropic.com' },
  { name: 'AWS', domain: 'aws.amazon.com', detail: 'Amazon Web Services' },
  { name: 'Google Cloud', domain: 'cloud.google.com' },
  { name: 'Cisco', domain: 'cisco.com' },
  { name: 'CompTIA', domain: 'comptia.org' },
  { name: 'PeopleCert', domain: 'peoplecert.org', detail: 'ITIL · PRINCE2' },
  { name: 'PMI', domain: 'pmi.org', detail: 'Project Management Institute' },
  { name: 'ISC2', domain: 'isc2.org' },
  { name: 'ISACA', domain: 'isaca.org' },
  { name: 'Linux Foundation', domain: 'linuxfoundation.org' },
  { name: 'Red Hat', domain: 'redhat.com' },
  { name: 'Oracle', domain: 'oracle.com' },
]

const providerLogoDomains: Record<string, string> = {
  adobe: 'adobe.com', amazon: 'aws.amazon.com', 'amazon web services': 'aws.amazon.com', anthropic: 'anthropic.com', apple: 'apple.com',
  atlassian: 'atlassian.com', aws: 'aws.amazon.com', cisco: 'cisco.com', comptia: 'comptia.org',
  google: 'google.com', 'google cloud': 'cloud.google.com', gcp: 'cloud.google.com', hashicorp: 'hashicorp.com',
  ibm: 'ibm.com', isc2: 'isc2.org', isaca: 'isaca.org', juniper: 'juniper.net', 'juniper networks': 'juniper.net',
  'linux foundation': 'linuxfoundation.org', microsoft: 'microsoft.com', 'microsoft azure': 'microsoft.com',
  oracle: 'oracle.com', peoplecert: 'peoplecert.org', pmi: 'pmi.org', 'project management institute': 'pmi.org',
  'red hat': 'redhat.com', salesforce: 'salesforce.com', sap: 'sap.com', vmware: 'vmware.com', azure: 'microsoft.com',
}

function Dashboard({ isAdmin, onOpen, onCreate }: { isAdmin: boolean; onOpen: (item: Certification) => void; onCreate: () => void }) {
  const request = useApi()
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
  </div>
}

function ProviderLogo({ name, domain }: { name: string; domain?: string }) {
  const logoDomain = domain ?? providerLogoDomains[name.toLowerCase()]
  const [logoFailed, setLogoFailed] = useState(false)
  return logoDomain && !logoFailed ? <img src={`https://www.google.com/s2/favicons?domain=${logoDomain}&sz=128`} alt="" aria-hidden="true" loading="lazy" onError={() => setLogoFailed(true)} /> : <span aria-hidden="true">{name.trim().slice(0, 1).toUpperCase()}</span>
}

function SavedResources({ onBack }: { onBack: () => void }) {
  const request = useApi()
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
  async function helpful(resource: Resource) { await toggleHelpful(request, resource.id); await refresh() }
  return <div className="page-content"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Certification library</button><header className="topbar saved-heading"><div><p className="breadcrumb">YOUR LIBRARY <span>/</span> SAVED</p><h1>Saved resources</h1></div></header>{error && <div className="alert error">{error}</div>}{loading ? <div className="loading-state"><LoaderCircle className="spin" size={20} /> Loading saved resources</div> : items.length ? <div className="resource-grid">{items.map((resource) => <div key={resource.id}><p className="saved-certification">{resource.certification?.provider} · {resource.certification?.code}</p><ResourceCard resource={resource} canEdit={false} onOpen={() => setActive(resource)} onDelete={() => {}} onDownload={() => void download(resource)} onBookmark={() => void removeBookmark(resource)} onHelpful={() => void helpful(resource)} /></div>)}</div> : <div className="empty-state"><div className="empty-icon"><Bookmark size={21} /></div><h3>No saved resources</h3><p>Save useful material from a resource detail view to find it here later.</p></div>}{active && <ResourceDetailDialog resource={active} onClose={() => setActive(null)} onDownload={() => void download(active)} onChanged={() => void refresh()} />}</div>
}

function AdminReviewPanel() {
  const request = useApi()
  const [reports, setReports] = useState<ResourceReport[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    try { setReports(await getOpenReports(request)); setError('') }
    catch (reason) { setError(message(reason, 'Could not load the review queue.')) }
    finally { setLoading(false) }
  }, [request])
  useEffect(() => {
    let active = true
    getOpenReports(request).then((data) => { if (active) { setReports(data); setError('') } }).catch((reason: unknown) => { if (active) setError(message(reason, 'Could not load the review queue.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request])
  async function moderate(resource: Resource, change: { isVisible?: boolean; reviewed?: boolean }) {
    try { await moderateResource(request, resource.id, change); await refresh() }
    catch (reason) { setError(message(reason, 'Could not update resource review state.')) }
  }
  async function closeReport(id: string, status: 'RESOLVED' | 'DISMISSED') {
    try { await resolveReport(request, id, status); await refresh() }
    catch (reason) { setError(message(reason, 'Could not update report.')) }
  }
  return <section className="admin-review"><div className="section-heading"><div><p className="eyebrow">ADMINISTRATION</p><h2>Resource review queue</h2><p>Review reports, mark checked resources, or hide material from the shared library.</p></div><span className="result-count">{loading ? 'Loading' : `${reports.length} open reports`}</span></div>{error && <div className="alert error">{error}</div>}{loading ? <div className="loading-state"><LoaderCircle className="spin" size={18} /> Loading queue</div> : reports.length ? <div className="report-list">{reports.map((report) => <article className="report-row" key={report.id}><div className="report-info"><span className="report-category"><Flag size={14} /> {report.category.replaceAll('_', ' ')}</span><strong>{report.resource.title}</strong><span>{report.resource.certification?.title} · Reported by {report.reporterName} · {formatDate(report.createdAt)}</span>{report.message && <p>{report.message}</p>}</div><div className="report-actions"><button className="button button-secondary" onClick={() => void moderate(report.resource, { reviewed: true })}><BadgeCheck size={15} /> Mark reviewed</button><button className="button button-secondary" onClick={() => void moderate(report.resource, { isVisible: !report.resource.isVisible })}>{report.resource.isVisible ? <EyeOff size={15} /> : <Eye size={15} />}{report.resource.isVisible ? 'Hide resource' : 'Restore resource'}</button><button className="button button-quiet" onClick={() => void closeReport(report.id, 'RESOLVED')}><Check size={15} /> Resolve</button><button className="icon-button" title="Dismiss report" aria-label="Dismiss report" onClick={() => void closeReport(report.id, 'DISMISSED')}><XCircle size={16} /></button></div></article>)}</div> : <div className="admin-empty"><BadgeCheck size={17} /> No open reports</div>}</section>
}

function CertificationDialog({ existing, onClose, onSaved }: { existing?: Certification; onClose: () => void; onSaved: (item: Certification) => void }) {
  const request = useApi()
  const [form, setForm] = useState<CertificationInput>({ provider: existing?.provider ?? '', code: existing?.code ?? '', title: existing?.title ?? '', description: existing?.description ?? '', status: existing?.status ?? 'ACTIVE', examVersion: existing?.examVersion ?? '', examUpdatedAt: existing?.examUpdatedAt ?? null })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const result = existing ? await request<Certification>(`/api/certifications/${existing.id}`, { method: 'PATCH', body: JSON.stringify(form) }) : await request<Certification>('/api/certifications', { method: 'POST', body: JSON.stringify(form) })
      onSaved(result)
    } catch (reason) { setError(message(reason, 'Could not save certification.')) }
    finally { setSaving(false) }
  }
  function change(field: keyof CertificationInput, value: string) { setForm((current) => ({ ...current, [field]: value })) }
  return <Modal onClose={onClose}><div className="form-heading"><p className="eyebrow">CERTIFICATION DETAILS</p><h1>{existing ? 'Edit certification' : 'Create a certification'}</h1><p>Set up a listing people can find and contribute to.</p></div><form className="form-panel" onSubmit={submit}>{error && <div className="alert error" role="alert">{error}</div>}<div className="form-grid"><label className="field"><span>Provider</span><input required maxLength={80} value={form.provider} onChange={(event) => change('provider', event.target.value)} placeholder="e.g. Microsoft" /></label><label className="field"><span>Certification code</span><input required maxLength={40} value={form.code} onChange={(event) => change('code', event.target.value.toUpperCase())} placeholder="e.g. AB-100" /></label></div><label className="field"><span>Certification title</span><input required maxLength={160} value={form.title} onChange={(event) => change('title', event.target.value)} placeholder="e.g. Azure Data Fundamentals" /></label><label className="field"><span>Description <small>Optional</small></span><textarea rows={3} maxLength={2000} value={form.description} onChange={(event) => change('description', event.target.value)} placeholder="What does this certification cover?" /></label><div className="form-grid"><label className="field"><span>Lifecycle status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CertificationInput['status'] }))}><option value="ACTIVE">Active</option><option value="RETIRED">Retired</option></select></label><label className="field"><span>Exam version <small>Optional</small></span><input maxLength={80} value={form.examVersion} onChange={(event) => setForm((current) => ({ ...current, examVersion: event.target.value }))} placeholder="e.g. 2026" /></label></div><label className="field"><span>Exam content last updated <small>Optional</small></span><input type="date" value={form.examUpdatedAt?.slice(0, 10) ?? ''} onChange={(event) => setForm((current) => ({ ...current, examUpdatedAt: event.target.value ? new Date(`${event.target.value}T00:00:00.000Z`).toISOString() : null }))} /></label><div className="form-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button disabled={saving} className="button button-primary">{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{existing ? 'Save changes' : 'Create certification'}</button></div></form></Modal>
}

function DetailView({ certification, userId, isAdmin, onBack, onEdit, onAddResource, onChanged }: { certification: Certification; userId: string; isAdmin: boolean; onBack: () => void; onEdit: () => void; onAddResource: () => void; onChanged: () => void }) {
  const request = useApi()
  const [item, setItem] = useState(certification)
  const [error, setError] = useState('')
  const [activeResource, setActiveResource] = useState<Resource | null>(null)
  const canEdit = isAdmin || item.createdById === userId
  const refresh = useCallback(async () => { try { setItem(await request<Certification>(`/api/certifications/${item.id}`)); setError('') } catch (reason) { setError(message(reason, 'Could not refresh certification.')) } }, [item.id, request])
  useEffect(() => {
    let active = true
    request<Certification>(`/api/certifications/${certification.id}`).then((data) => { if (active) { setItem(data); setError('') } }).catch((reason: unknown) => { if (active) setError(message(reason, 'Could not load certification resources.')) })
    return () => { active = false }
  }, [certification.id, request])
  async function remove(resource: Resource) {
    if (!window.confirm(`Remove “${resource.title}” from this certification?`)) return
    try { await request(`/api/resources/${resource.id}`, { method: 'DELETE' }); await refresh(); onChanged() } catch (reason) { setError(message(reason, 'Could not remove resource.')) }
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
  return <div className="page-content detail-page"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> All certifications</button><header className="detail-header"><div className="detail-title"><span className="provider-glyph glyph-1 large-glyph">{item.provider.slice(0, 1).toUpperCase()}</span><div><p className="breadcrumb">{item.provider.toUpperCase()} <span>/</span> {item.code}</p><h1>{item.title}{item.status === 'RETIRED' && <span className="status-label retired">Retired</span>}</h1><p className="detail-description">{item.description || 'No description added yet.'}</p></div></div><div className="detail-actions">{canEdit && <button className="button button-secondary" onClick={onEdit}>Edit details</button>}<button className="button button-primary" onClick={onAddResource}><Plus size={16} /> Add resource</button></div></header><div className="detail-meta"><span><BookOpen size={15} /> {item.code}</span>{item.examVersion && <span>Exam version {item.examVersion}</span>}{item.examUpdatedAt && <span><CalendarDays size={15} /> Exam updated {formatDate(item.examUpdatedAt)}</span>}<span><FileText size={15} /> {item.resources.length} resources</span></div>{item.topics.length > 0 && <div className="topic-list">{item.topics.map((topic) => <span className="topic-chip" key={topic}>{topic}</span>)}</div>}{error && <div className="alert error">{error}</div>}<section className="resources-section"><div className="section-heading"><div><h2>Study resources</h2><p>Materials shared for this certification.</p></div></div>{item.resources.length ? <div className="resource-grid">{item.resources.map((resource) => <ResourceCard key={resource.id} resource={resource} canEdit={isAdmin || resource.createdById === userId} onOpen={() => setActiveResource(resource)} onDelete={() => void remove(resource)} onDownload={() => void download(resource)} onBookmark={() => void bookmark(resource)} onHelpful={() => void helpful(resource)} />)}</div> : <div className="empty-state"><div className="empty-icon"><FileText size={22} /></div><h3>No resources yet</h3><p>Add the first question set, study note, link, or PDF.</p><button className="button button-secondary" onClick={onAddResource}><Plus size={16} /> Add resource</button></div>}</section>{activeResource && <ResourceDetailDialog resource={activeResource} onClose={() => setActiveResource(null)} onDownload={() => void download(activeResource)} onChanged={() => void refresh()} />}</div>
}

function ResourceCard({ resource, canEdit, onOpen, onDelete, onDownload, onBookmark, onHelpful }: { resource: Resource; canEdit: boolean; onOpen: () => void; onDelete: () => void; onDownload: () => void; onBookmark: () => void; onHelpful: () => void }) {
  const content = parseResourceContent(resource.content)
  const questionCount = Array.isArray(content.questions) ? content.questions.length : 0
  const fileName = typeof content.originalFileName === 'string' ? content.originalFileName : 'PDF document attached'
  const summary = resource.type === 'QUESTION_SET' ? `${questionCount} study questions` : resource.type === 'RICH_TEXT' ? 'Formatted study notes' : resource.type === 'LINK' ? 'External learning resource' : fileName
  return <article className="resource-card"><header className="resource-card-top"><span className={`resource-type type-${resource.type.toLowerCase()}`}>{resource.type === 'PDF' ? <FileText size={15} /> : resource.type === 'LINK' ? <Link2 size={15} /> : resource.type === 'QUESTION_SET' ? <CircleHelp size={15} /> : <BookOpen size={15} />}{labels[resource.type]}</span><span className="resource-card-tools">{resource.isReviewed && <span className="reviewed-label" title="Reviewed by an administrator"><BadgeCheck size={14} /> Reviewed</span>}{canEdit && <button className="icon-button danger-hover" aria-label={`Remove ${resource.title}`} title="Remove resource" onClick={onDelete}><Trash2 size={15} /></button>}</span></header>
    <button type="button" className="resource-open-button" onClick={onOpen}><span className="resource-open-title">{resource.title}<ArrowUpRight size={15} /></span><span className="resource-summary">{summary}</span><span className="resource-open-hint">Open details</span></button>
    <div className="resource-topic-list">{resource.topics.map((topic) => <span className="topic-chip" key={topic}>{topic}</span>)}</div>
    <div className="resource-actions"><button className={`resource-action ${resource.isBookmarked ? 'selected' : ''}`} title={resource.isBookmarked ? 'Remove saved resource' : 'Save resource'} aria-label={resource.isBookmarked ? 'Remove saved resource' : 'Save resource'} onClick={onBookmark}><Bookmark size={15} /> <span>{resource.isBookmarked ? 'Saved' : 'Save'}</span></button><button className={`resource-action ${resource.isHelpful ? 'selected' : ''}`} title="Mark helpful" aria-label="Mark helpful" onClick={onHelpful}><ThumbsUp size={15} /> <span>Helpful {resource.helpfulCount || ''}</span></button><span className="resource-format-meta">{resource.language.toUpperCase()}{resource.estimatedMinutes ? ` · ${resource.estimatedMinutes} min` : ''}</span></div>
    {resource.type === 'PDF' && <button className="resource-link" onClick={onDownload}><ArrowDownToLine size={15} /> Download PDF</button>}
    <footer className="resource-card-footer"><span>Added by {resource.createdByName}</span><span>{formatDate(resource.createdAt)}</span></footer>
  </article>
}

function ResourceDetailDialog({ resource, onClose, onDownload, onChanged }: { resource: Resource; onClose: () => void; onDownload: () => void; onChanged: () => void }) {
  const request = useApi()
  const content = parseResourceContent(resource.content)
  const questions = Array.isArray(content.questions) ? content.questions as { question: string; answer?: string; explanation?: string }[] : []
  const fileName = resource.originalFileName ?? 'PDF document'
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [reportCategory, setReportCategory] = useState('BROKEN_LINK')
  const [reportMessage, setReportMessage] = useState('')
  const [reportStatus, setReportStatus] = useState('')
  const [savingReport, setSavingReport] = useState(false)
  useEffect(() => {
    if (resource.type !== 'PDF') return
    let active = true
    let objectUrl = ''
    request<Blob>(`/api/resources/${resource.id}/file`).then((blob) => { objectUrl = URL.createObjectURL(blob); if (active) setPreviewUrl(objectUrl) }).catch((error: unknown) => { if (active) setPreviewError(message(error, 'PDF preview is unavailable. Use Download PDF instead.')) })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [request, resource.id, resource.type])
  async function markHelpful() {
    try { await toggleHelpful(request, resource.id); onChanged() } catch (error) { setReportStatus(message(error, 'Could not record feedback.')) }
  }
  async function saveBookmark() {
    try { await toggleBookmark(request, resource.id); onChanged() } catch (error) { setReportStatus(message(error, 'Could not update saved resources.')) }
  }
  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSavingReport(true)
    try { await reportResource(request, resource.id, reportCategory, reportMessage); setReportStatus('Thanks. Your report was sent to the review queue.'); setReportOpen(false) }
    catch (error) { setReportStatus(message(error, 'Could not submit the report.')) }
    finally { setSavingReport(false) }
  }
  return <Modal onClose={onClose}><div className="resource-detail"><span className={`resource-type type-${resource.type.toLowerCase()}`}>{resource.type === 'PDF' ? <FileText size={15} /> : resource.type === 'LINK' ? <Link2 size={15} /> : resource.type === 'QUESTION_SET' ? <CircleHelp size={15} /> : <BookOpen size={15} />}{labels[resource.type]}</span>
    <h1>{resource.title}</h1><p className="resource-detail-meta">Added by {resource.createdByName} · {formatDate(resource.createdAt)}</p>
    <div className="resource-detail-meta-grid"><span><strong>Language</strong>{resource.language.toUpperCase()}</span>{resource.estimatedMinutes && <span><strong>Study time</strong>{resource.estimatedMinutes} minutes</span>}{resource.isReviewed && <span className="reviewed-label"><BadgeCheck size={14} /> Reviewed {resource.reviewedAt ? formatDate(resource.reviewedAt) : ''}</span>}</div>
    {resource.topics.length > 0 && <div className="topic-list">{resource.topics.map((topic) => <span className="topic-chip" key={topic}>{topic}</span>)}</div>}
    {resource.sourceName && <p className="source-credit">Source: {resource.sourceUrl ? <a href={resource.sourceUrl} target="_blank" rel="noreferrer">{resource.sourceName} <ArrowUpRight size={13} /></a> : resource.sourceName}</p>}
    {resource.type === 'QUESTION_SET' && <div className="question-detail-list">{questions.map((question, index) => <article className="question-detail" key={index}><span>QUESTION {String(index + 1).padStart(2, '0')}</span><h2>{question.question}</h2>{question.answer && <p><strong>Answer</strong>{question.answer}</p>}{question.explanation && <p><strong>Explanation</strong>{question.explanation}</p>}</article>)}</div>}
    {resource.type === 'RICH_TEXT' && <div className="rich-detail" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(typeof content.html === 'string' ? content.html : '') }} />}
    {resource.type === 'LINK' && typeof content.url === 'string' && <a className="button button-primary" href={content.url} target="_blank" rel="noreferrer">Open external resource <ArrowUpRight size={15} /></a>}
    {resource.type === 'PDF' && <div className="pdf-detail"><div className="pdf-detail-head"><FileText size={22} /><div><strong>{fileName}</strong><small>PDF document · {resource.fileSize ? `${(resource.fileSize / 1024 / 1024).toFixed(1)} MB` : 'attached'}</small></div><button className="button button-primary" onClick={onDownload}><ArrowDownToLine size={16} /> Download PDF</button></div>{previewError ? <p className="field-hint">{previewError}</p> : previewUrl ? <iframe className="pdf-preview" title={`PDF preview: ${fileName}`} src={previewUrl} /> : <div className="pdf-preview-loading"><LoaderCircle className="spin" size={18} /> Loading preview</div>}</div>}
    <div className="resource-detail-actions"><button className={`button button-secondary ${resource.isBookmarked ? 'selected' : ''}`} onClick={() => void saveBookmark()}><Bookmark size={15} /> {resource.isBookmarked ? 'Saved' : 'Save for later'}</button><button className={`button button-secondary ${resource.isHelpful ? 'selected' : ''}`} onClick={() => void markHelpful()}><ThumbsUp size={15} /> Helpful{resource.helpfulCount ? ` · ${resource.helpfulCount}` : ''}</button><button className="button button-quiet" onClick={() => setReportOpen((open) => !open)}><Flag size={15} /> Report an issue</button></div>
    {reportStatus && <div className="report-status" role="status">{reportStatus}</div>}{reportOpen && <form className="report-form" onSubmit={submitReport}><label className="field"><span>Issue type</span><select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}><option value="BROKEN_LINK">Broken link or file</option><option value="OUTDATED">Outdated content</option><option value="INCORRECT">Incorrect information</option><option value="RIGHTS_CONCERN">Rights or attribution concern</option><option value="OTHER">Other</option></select></label><label className="field"><span>Details <small>Optional</small></span><textarea rows={2} maxLength={1000} value={reportMessage} onChange={(event) => setReportMessage(event.target.value)} placeholder="What should the reviewer know?" /></label><button disabled={savingReport} className="button button-primary">{savingReport ? 'Sending…' : 'Send report'}</button></form>}
  </div></Modal>
}

function parseResourceContent(value: string): Record<string, unknown> { try { return JSON.parse(value) as Record<string, unknown> } catch { return {} } }

function ResourceDialog({ certification, onClose, onSaved }: { certification: Certification; onClose: () => void; onSaved: () => void }) {
  const request = useApi()
  const [kind, setKind] = useState<ResourceKind>('QUESTION_SET')
  const [title, setTitle] = useState('')
  const [html, setHtml] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [questions, setQuestions] = useState([{ question: '', answer: '', explanation: '' }])
  const [topicsText, setTopicsText] = useState('')
  const [language, setLanguage] = useState('en')
  const [estimatedMinutes, setEstimatedMinutes] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSaving(true)
    try {
      const body: ResourceInput = { type: kind, title: title.trim(), content: {}, topics: topicsText.split(',').map((topic) => topic.trim()).filter(Boolean), language, estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null, sourceName, sourceUrl, rightsConfirmed }
      if (kind === 'QUESTION_SET') body.content = { questions: questions.filter((question) => question.question.trim()) }
      if (kind === 'RICH_TEXT') body.content = { html }
      if (kind === 'LINK') body.content = { url }
      if (kind === 'PDF') { if (!file) throw new Error('Choose a PDF file to upload.'); const data = new FormData(); data.append('title', body.title); data.append('file', file); data.append('topics', JSON.stringify(body.topics)); data.append('language', body.language); data.append('estimatedMinutes', estimatedMinutes); data.append('sourceName', body.sourceName); data.append('sourceUrl', body.sourceUrl); data.append('rightsConfirmed', String(body.rightsConfirmed)); await request(`/api/certifications/${certification.id}/resources`, { method: 'POST', body: data }) }
      else await request(`/api/certifications/${certification.id}/resources`, { method: 'POST', body: JSON.stringify(body) })
      onSaved()
    } catch (reason) { setError(message(reason, 'Could not save resource.')) }
    finally { setSaving(false) }
  }
  return <Modal onClose={onClose}><div className="form-heading"><p className="eyebrow">CONTRIBUTE TO {certification.code}</p><h1>Add study material</h1><p>Share a useful resource with everyone following this certification.</p></div><form className="form-panel" onSubmit={submit}>{error && <div className="alert error">{error}</div>}<fieldset className="resource-kind-fieldset"><legend>Resource type</legend><div className="resource-kind-options">{(Object.keys(labels) as ResourceKind[]).map((option) => <button type="button" className={`kind-option ${kind === option ? 'selected' : ''}`} key={option} onClick={() => setKind(option)}><span className="kind-icon">{option === 'QUESTION_SET' ? <CircleHelp size={18} /> : option === 'RICH_TEXT' ? <BookOpen size={18} /> : option === 'LINK' ? <Link2 size={18} /> : <Upload size={18} />}</span><strong>{labels[option]}</strong><small>{option === 'QUESTION_SET' ? 'Questions and answers' : option === 'RICH_TEXT' ? 'Formatted study notes' : option === 'LINK' ? 'External learning page' : 'Upload a document'}</small></button>)}</div></fieldset><label className="field"><span>Resource title</span><input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Give this material a clear name" /></label>
    {kind === 'QUESTION_SET' && <QuestionSetEditor questions={questions} onChange={setQuestions} />}{kind === 'RICH_TEXT' && <div className="field"><span>Study notes</span><RichTextEditor value={html} onChange={setHtml} /></div>}{kind === 'LINK' && <label className="field"><span>Resource URL</span><input type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" /><small className="field-hint">Only HTTPS links are accepted.</small></label>}{kind === 'PDF' && <label className="field"><span>PDF document</span><span className={`file-drop ${file ? 'has-file' : ''}`}><Upload size={20} /><strong>{file?.name ?? 'Choose a PDF to attach'}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'PDF only · 10 MB maximum'}</small><input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /></span></label>}
    <div className="metadata-fields"><label className="field"><span>Topics <small>Comma separated, up to 10</small></span><input maxLength={320} value={topicsText} onChange={(event) => setTopicsText(event.target.value)} placeholder="identity, networking, data" /></label><div className="form-grid"><label className="field"><span>Language</span><input required maxLength={15} value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="en" /></label><label className="field"><span>Estimated study time <small>Minutes, optional</small></span><input type="number" min="1" max="1000" value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(event.target.value)} placeholder="20" /></label></div><div className="form-grid"><label className="field"><span>Source / attribution <small>Optional</small></span><input maxLength={120} value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Publisher or author" /></label><label className="field"><span>Source URL <small>Optional, HTTPS</small></span><input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://" /></label></div></div>
    {(kind === 'QUESTION_SET' || kind === 'PDF') && <label className="rights-confirmation"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} required /><span>I created this material or have permission to share it. I will not upload restricted or copied exam questions.</span></label>}
    <div className="form-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button disabled={saving} className="button button-primary">{saving ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Add resource</button></div></form></Modal>
}

type Question = { question: string; answer: string; explanation: string }
function QuestionSetEditor({ questions, onChange }: { questions: Question[]; onChange: (value: Question[]) => void }) {
  function update(index: number, field: keyof Question, value: string) { onChange(questions.map((question, itemIndex) => itemIndex === index ? { ...question, [field]: value } : question)) }
  return <div className="question-editor"><div className="question-editor-head"><strong>Questions</strong><button type="button" className="text-button" onClick={() => onChange([...questions, { question: '', answer: '', explanation: '' }])}><Plus size={15} /> Add question</button></div>{questions.map((question, index) => <div className="question-block" key={index}><div className="question-block-head"><span>QUESTION {String(index + 1).padStart(2, '0')}</span>{questions.length > 1 && <button type="button" className="icon-button" aria-label="Remove question" onClick={() => onChange(questions.filter((_, itemIndex) => itemIndex !== index))}>×</button>}</div><label className="field"><span>Question</span><textarea required rows={2} value={question.question} onChange={(event) => update(index, 'question', event.target.value)} placeholder="Write a study question" /></label><div className="form-grid"><label className="field"><span>Answer</span><textarea rows={2} value={question.answer} onChange={(event) => update(index, 'answer', event.target.value)} placeholder="Suggested answer" /></label><label className="field"><span>Explanation <small>Optional</small></span><textarea rows={2} value={question.explanation} onChange={(event) => update(index, 'explanation', event.target.value)} placeholder="Why is this the answer?" /></label></div></div>)}</div>
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal-panel" role="dialog" aria-modal="true"><button className="modal-close" aria-label="Close dialog" onClick={onClose}>×</button>{children}</section></div>
}
function message(error: unknown, fallback: string) { return error instanceof ApiError || error instanceof Error ? error.message : fallback }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Recently' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date) }