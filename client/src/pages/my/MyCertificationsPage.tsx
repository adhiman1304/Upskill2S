import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BookmarkCheck, Check, LoaderCircle, Plus, Search, Trash2, X } from 'lucide-react'
import { Tabs } from '../../components/ui/Tabs'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useTabParam } from '../../hooks/useTabParam'
import { searchCatalog } from '../../lib/api/catalog'
import { listMyCertifications, removeMyCertification, saveMyCertifications, setMyCertification } from '../../lib/api/myCertifications'
import type { CatalogHitDto, FollowStatus, MyCertificationDto, MyCertificationsDto } from '../../lib/contracts'
import { useApi } from '../../session'
import { ProviderLogo } from '../legacy/providers'
import { formatDate, message } from '../legacy/utils'
import { FreshnessChip } from '../home/FreshnessChip'
import './my-certifications.css'

const tabIds = ['studying', 'planning', 'passed'] as const
type TabId = (typeof tabIds)[number]
const statusLabels: Record<FollowStatus, string> = { STUDYING: 'Studying', PLANNING: 'Planning', PASSED: 'Passed' }
const SEARCH_DEBOUNCE_MS = 250

function formatTargetDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function MyCertificationsPage() {
  useDocumentTitle('My certifications')
  const request = useApi()
  const [data, setData] = useState<MyCertificationsDto | null>(null)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, selectTab] = useTabParam(tabIds)

  useEffect(() => {
    let active = true
    listMyCertifications(request)
      .then((result) => { if (active) setData(result) })
      .catch((reason: unknown) => { if (active) setLoadError(message(reason, 'Could not load your certifications.')) })
    return () => { active = false }
  }, [request])

  async function run(id: string, action: () => Promise<MyCertificationsDto>, done?: string) {
    setBusyId(id)
    setActionError('')
    setNotice('')
    try {
      setData(await action())
      if (done) setNotice(done)
    } catch (reason) {
      setActionError(message(reason, 'Could not update your certifications.'))
    } finally {
      setBusyId(null)
    }
  }

  function changeStatus(item: MyCertificationDto, status: FollowStatus) {
    void run(item.certificationId, () => setMyCertification(request, item.certificationId, { status }), `Moved ${item.code} to ${statusLabels[status]}.`)
  }

  function remove(item: MyCertificationDto) {
    void run(item.certificationId, () => removeMyCertification(request, item.certificationId), `Removed ${item.code} from My certifications.`)
  }

  function onAdded(result: MyCertificationsDto, code: string) {
    setData(result)
    setAdding(false)
    setActionError('')
    setNotice(`Saved ${code} to Passed.`)
    selectTab('passed')
  }

  const counts = { studying: data?.studying.length ?? 0, planning: data?.planning.length ?? 0, passed: data?.passed.length ?? 0 }
  const panel = (tab: TabId) => {
    if (!data) return null
    const items = data[tab]
    if (!items.length) return <EmptyTab tab={tab} onAdd={() => setAdding(true)} />
    return <ul className="list my-cert-list">{items.map((item) => <MyCertificationRow key={item.certificationId} item={item} busy={busyId === item.certificationId} disabled={busyId !== null} onStatus={(status) => changeStatus(item, status)} onRemove={() => remove(item)} />)}</ul>
  }

  return <div className="page-content my-certs-page">
    <header className="page-header">
      <div><h1>My certifications</h1><p className="page-desc">What you are studying, planning and already hold.</p></div>
      {!adding && <button type="button" className="button button-primary" onClick={() => { setAdding(true); setNotice('') }}><Plus size={15} aria-hidden="true" />Add one I already hold</button>}
    </header>

    {adding && <AddHeldForm onCancel={() => setAdding(false)} onSaved={onAdded} />}
    {notice && <div className="alert success my-certs-notice" role="status"><Check size={15} aria-hidden="true" />{notice}</div>}
    {actionError && <div className="alert error" role="alert">{actionError}</div>}
    {loadError && <div className="alert error" role="alert">{loadError}</div>}
    {!data && !loadError && <div className="loading-state"><LoaderCircle className="spin" size={20} aria-hidden="true" /> Loading your certifications</div>}

    {data && <Tabs mode="tabs" label="My certifications by status" tabs={[
      { id: 'studying', label: `Studying (${counts.studying})`, content: panel('studying') },
      { id: 'planning', label: `Planning (${counts.planning})`, content: panel('planning') },
      { id: 'passed', label: `Passed (${counts.passed})`, content: panel('passed') },
    ]} />}
  </div>
}

function MyCertificationRow({ item, busy, disabled, onStatus, onRemove }: { item: MyCertificationDto; busy: boolean; disabled: boolean; onStatus: (status: FollowStatus) => void; onRemove: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const selectId = useId()
  const passed = item.status === 'PASSED'
  const meta: ReactNode[] = []
  if (passed) {
    meta.push(<span key="passed" className="chip chip-passed">{item.yearObtained ? `Earned ${item.yearObtained}` : 'Passed'}</span>)
    if (!item.yearObtained && item.passedAt) meta.push(<small key="added">Added {formatDate(item.passedAt)}</small>)
  } else {
    meta.push(<FreshnessChip key="fresh" status={item.brief?.freshness ?? 'missing'} />)
    if (item.brief && item.brief.checklistTotal > 0) meta.push(<small key="progress">{item.brief.checklistDone} of {item.brief.checklistTotal}</small>)
    if (item.targetDate) meta.push(<small key="target">Target {formatTargetDate(item.targetDate)}</small>)
  }
  return <li className="my-cert-row">
    <Link className="my-cert-main" to={`/certifications/${encodeURIComponent(item.certificationId)}`}>
      <span className="provider-logo"><ProviderLogo name={item.provider} /></span>
      <span className="my-cert-text">
        <strong>{item.code} <span className="my-cert-provider">{item.provider}</span></strong>
        <span className="my-cert-title">{item.title}</span>
        <span className="my-cert-meta">{meta}</span>
      </span>
    </Link>
    <div className="my-cert-actions">
      {confirming
        ? <span className="my-cert-confirm"><span>Remove?</span>
            <button type="button" className="button button-secondary button-small" disabled={disabled} onClick={() => { setConfirming(false); onRemove() }}>Remove</button>
            <button type="button" className="button button-quiet button-small" onClick={() => setConfirming(false)}>Keep</button>
          </span>
        : <>
            <label className="sr-only" htmlFor={selectId}>Status for {item.code}</label>
            <select id={selectId} className="my-cert-select" value={item.status} disabled={disabled} onChange={(event) => onStatus(event.target.value as FollowStatus)}>
              {(['STUDYING', 'PLANNING', 'PASSED'] as const).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
            {busy ? <span className="icon-button" aria-hidden="true"><LoaderCircle className="spin" size={15} /></span>
              : <button type="button" className="icon-button" aria-label={`Remove ${item.code}`} title="Remove" disabled={disabled} onClick={() => setConfirming(true)}><Trash2 size={15} /></button>}
          </>}
    </div>
  </li>
}

function EmptyTab({ tab, onAdd }: { tab: TabId; onAdd: () => void }) {
  if (tab === 'passed') return <div className="empty-state"><BookmarkCheck className="empty-icon" size={20} aria-hidden="true" /><h3>No passed certifications yet</h3><p>Add the certifications you already hold, or upload your resume in Help me choose and we will find them for you.</p><div className="my-certs-empty-actions"><button type="button" className="button button-secondary" onClick={onAdd}>Add one I already hold</button><Link className="button button-quiet" to="/intake">Help me choose</Link></div></div>
  const text = tab === 'studying'
    ? 'Find an exam on Home and set its status to Studying on the study brief.'
    : 'Certifications you want to take later show up here. Set a status to Planning on any study brief.'
  return <div className="empty-state"><BookmarkCheck className="empty-icon" size={20} aria-hidden="true" /><h3>Nothing {tab === 'studying' ? 'in progress' : 'planned'}</h3><p>{text}</p><div className="my-certs-empty-actions"><Link className="button button-secondary" to="/">Search certifications</Link><Link className="button button-quiet" to="/intake">Help me choose</Link></div></div>
}

/** Inline form: search the catalog (same data as Home search) and pick a hit, or type provider, code and title. Saves as Passed. */
function AddHeldForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: (result: MyCertificationsDto, code: string) => void }) {
  const request = useApi()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<{ key: string; items: CatalogHitDto[] }>({ key: '', items: [] })
  const [manual, setManual] = useState(false)
  const [fields, setFields] = useState({ provider: '', code: '', title: '' })
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const trimmed = query.trim()

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!trimmed) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchCatalog(request, trimmed, { signal: controller.signal })
        .then((items) => setHits({ key: trimmed, items: items.slice(0, 6) }))
        .catch(() => { if (!controller.signal.aborted) setHits({ key: trimmed, items: [] }) })
    }, SEARCH_DEBOUNCE_MS)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [request, trimmed])

  async function save(key: string, item: { provider: string; code: string; title: string; officialUrl?: string | null }) {
    setSaving(key)
    setError('')
    try {
      onSaved(await saveMyCertifications(request, [{ ...item, status: 'PASSED' }]), item.code)
    } catch (reason) {
      setError(message(reason, 'Could not save this certification.'))
      setSaving(null)
    }
  }

  function submitManual(event: FormEvent) {
    event.preventDefault()
    void save('manual', { provider: fields.provider.trim(), code: fields.code.trim(), title: fields.title.trim() })
  }

  const shown = trimmed && hits.key === trimmed ? hits.items : []
  const searching = Boolean(trimmed) && hits.key !== trimmed

  return <section className="card my-certs-add" aria-labelledby="add-held-heading">
    <div className="my-certs-add-head">
      <h2 id="add-held-heading">Add a certification you hold</h2>
      <button type="button" className="icon-button" aria-label="Close" onClick={onCancel}><X size={16} /></button>
    </div>
    {!manual ? <>
      <label className="my-certs-search">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Exam code or name</span>
        <input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Exam code or name, e.g. AZ-900" autoComplete="off" />
        {searching && <LoaderCircle className="spin" size={15} aria-hidden="true" />}
      </label>
      {shown.length > 0 && <ul className="my-certs-hits" aria-label="Matching certifications">{shown.map((hit) => {
        const key = hit.certificationId ?? `${hit.provider}:${hit.code}`
        return <li key={key}>
          <button type="button" className="my-certs-hit" disabled={saving !== null} onClick={() => void save(key, { provider: hit.provider, code: hit.code, title: hit.title, officialUrl: hit.officialUrl })}>
            <span className="provider-logo"><ProviderLogo name={hit.provider} /></span>
            <span className="my-cert-text"><strong>{hit.code} <span className="my-cert-provider">{hit.provider}</span></strong><span className="my-cert-title">{hit.title}</span></span>
            {saving === key ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : <span className="my-certs-hit-add">Add</span>}
          </button>
        </li>
      })}</ul>}
      {trimmed && !searching && !shown.length && <p className="muted my-certs-none">No match in the catalog.</p>}
      <p className="my-certs-manual-link"><button type="button" className="text-button" onClick={() => { setManual(true); setFields((current) => ({ ...current, code: current.code || trimmed })) }}>Not listed? Enter it yourself</button></p>
    </> : <form className="my-certs-manual" onSubmit={submitManual}>
      <div className="form-grid">
        <label className="field"><span>Provider</span><input value={fields.provider} onChange={(event) => setFields({ ...fields, provider: event.target.value })} maxLength={80} required placeholder="e.g. Microsoft" /></label>
        <label className="field"><span>Exam code</span><input value={fields.code} onChange={(event) => setFields({ ...fields, code: event.target.value })} maxLength={40} required placeholder="e.g. AZ-900" /></label>
      </div>
      <label className="field"><span>Title</span><input value={fields.title} onChange={(event) => setFields({ ...fields, title: event.target.value })} maxLength={160} required placeholder="e.g. Azure Fundamentals" /></label>
      <div className="form-actions">
        <button type="button" className="button button-quiet" onClick={() => setManual(false)}>Back to search</button>
        <button type="submit" className="button button-primary" disabled={saving !== null}>{saving === 'manual' && <LoaderCircle className="spin" size={15} aria-hidden="true" />}Save as passed</button>
      </div>
    </form>}
    {error && <div className="alert error" role="alert">{error}</div>}
  </section>
}
