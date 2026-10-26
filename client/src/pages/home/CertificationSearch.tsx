import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Clock, ExternalLink, KeyRound, LoaderCircle, RefreshCw, Search, Sparkles, X } from 'lucide-react'
import { KeyRequiredCallout } from '../../components/ui/KeyRequiredCallout'
import { identifyCertification, resolveCertification, searchCatalog } from '../../lib/api/catalog'
import { ApiError } from '../../lib/api/client'
import type { CatalogHitDto, IdentifyCandidate, IdentifyResult } from '../../lib/contracts'
import { useApi } from '../../session'
import { ProviderLogo } from '../legacy/providers'
import { message } from '../legacy/utils'
import { FreshnessChip } from './FreshnessChip'

const DEBOUNCE_MS = 250
/** The identify endpoint accepts 3 to 200 characters. */
const IDENTIFY_MIN = 3

type Option =
  | { kind: 'hit'; key: string; hit: CatalogHitDto }
  | { kind: 'identify'; key: string }
  | { kind: 'candidate'; key: string; candidate: IdentifyCandidate }

type IdentifyIssue = { kind: 'key' | 'invalid-key' | 'rate' | 'error'; message: string }
type IdentifyState = { key: string; status: 'loading' } | { key: string; status: 'done'; result: IdentifyResult } | { key: string; status: 'error'; issue: IdentifyIssue }

const confidenceChip: Record<IdentifyCandidate['confidence'], string> = { high: 'chip-passed', medium: 'chip-accent', low: 'chip-planning' }
const confidenceLabel: Record<IdentifyCandidate['confidence'], string> = { high: 'High', medium: 'Medium', low: 'Low' }

function hitKey(hit: CatalogHitDto) { return hit.certificationId ?? `catalog:${hit.provider}:${hit.code}` }
function candidateKey(candidate: IdentifyCandidate) { return `identify:${candidate.provider}:${candidate.code}` }

/**
 * Typeahead over GET /api/catalog/search. Selecting a catalog-only hit resolves it into a certification first.
 * From 3 characters the last row asks the agent to identify the certification on the web (POST /api/catalog/identify).
 */
export function CertificationSearch({ query, onQueryChange, inputRef }: { query: string; onQueryChange: (value: string) => void; inputRef: RefObject<HTMLInputElement | null> }) {
  const request = useApi()
  const navigate = useNavigate()
  const listId = useId()
  const trimmed = query.trim()
  const [result, setResult] = useState<{ key: string; hits: CatalogHitDto[]; error: string }>({ key: '', hits: [], error: '' })
  const [active, setActive] = useState<{ key: string; index: number }>({ key: '', index: 0 })
  const [open, setOpen] = useState(false)
  const [resolving, setResolving] = useState<{ key: string; error: string } | null>(null)
  const [identify, setIdentify] = useState<IdentifyState | null>(null)
  const [identifyVisible, setIdentifyVisible] = useState(false)
  const identifyAbort = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!trimmed) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchCatalog(request, trimmed, { signal: controller.signal })
        .then((hits) => setResult({ key: trimmed, hits, error: '' }))
        .catch((reason: unknown) => { if (!controller.signal.aborted) setResult({ key: trimmed, hits: [], error: message(reason, 'Search failed.') }) })
    }, DEBOUNCE_MS)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [request, trimmed])

  // Abandon a running identification when the query changes or the component unmounts.
  useEffect(() => () => identifyAbort.current?.abort(), [trimmed])

  const loading = Boolean(trimmed) && result.key !== trimmed
  const hits = trimmed && result.key === trimmed ? result.hits : []
  const canIdentify = trimmed.length >= IDENTIFY_MIN
  const identifying = identifyVisible && identify?.key === trimmed ? identify : null
  const options: Option[] = identifying
    ? identifying.status === 'done' ? identifying.result.candidates.map((candidate) => ({ kind: 'candidate', key: candidateKey(candidate), candidate })) : []
    : [...hits.map((hit): Option => ({ kind: 'hit', key: hitKey(hit), hit })), ...(canIdentify && !loading ? [{ kind: 'identify', key: 'identify' } as Option] : [])]
  const viewKey = identifying ? `identify:${trimmed}` : result.key
  const activeIndex = active.key === viewKey ? Math.min(active.index, Math.max(options.length - 1, 0)) : 0
  const showPanel = open && Boolean(trimmed)

  async function openCertification(target: { certificationId: string | null; provider: string; code: string; title: string; officialUrl: string | null }, key: string) {
    if (target.certificationId) { navigate(`/certifications/${encodeURIComponent(target.certificationId)}`); return }
    setResolving({ key, error: '' })
    try {
      const { id } = await resolveCertification(request, { provider: target.provider, code: target.code, title: target.title, officialUrl: target.officialUrl })
      navigate(`/certifications/${encodeURIComponent(id)}`)
    } catch (reason) {
      setResolving({ key, error: message(reason, 'Could not open this certification.') })
    }
  }

  async function runIdentify(force = false) {
    if (!canIdentify) return
    setIdentifyVisible(true)
    setResolving(null)
    const running = identify?.status === 'loading' && identifyAbort.current && !identifyAbort.current.signal.aborted
    if (!force && identify?.key === trimmed && (identify.status === 'done' || running)) return // Reuse the result (or the running request) for this query.
    identifyAbort.current?.abort()
    const controller = new AbortController()
    identifyAbort.current = controller
    const key = trimmed
    setIdentify({ key, status: 'loading' })
    try {
      const data = await identifyCertification(request, key, { signal: controller.signal })
      if (!controller.signal.aborted) setIdentify({ key, status: 'done', result: data })
    } catch (reason) {
      if (controller.signal.aborted) return
      const code = reason instanceof ApiError ? reason.code : undefined
      const issue: IdentifyIssue = code === 'OPENAI_KEY_MISSING' ? { kind: 'key', message: message(reason, '') }
        : code === 'OPENAI_KEY_INVALID' ? { kind: 'invalid-key', message: message(reason, '') }
          : code === 'RATE_LIMITED' || (reason instanceof ApiError && reason.status === 429) ? { kind: 'rate', message: message(reason, '') }
            : { kind: 'error', message: message(reason, 'Could not identify the certification.') }
      setIdentify({ key, status: 'error', issue })
    }
  }

  function backToResults() {
    if (identify?.status === 'loading') { identifyAbort.current?.abort(); setIdentify(null) }
    setIdentifyVisible(false)
    setResolving(null)
    inputRef.current?.focus()
  }

  function choose(option: Option) {
    if (option.kind === 'identify') void runIdentify()
    else if (option.kind === 'hit') void openCertification(option.hit, option.key)
    else {
      // A catalog-only match resolves under the catalog's canonical code.
      const { candidate } = option
      void openCertification({ certificationId: candidate.catalogMatch?.certificationId ?? null, provider: candidate.provider, code: candidate.catalogMatch?.code ?? candidate.code, title: candidate.title, officialUrl: candidate.officialUrl }, option.key)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (!options.length) return
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActive({ key: viewKey, index: (activeIndex + delta + options.length) % options.length })
    } else if (event.key === 'Enter') {
      if (showPanel && options[activeIndex]) { event.preventDefault(); choose(options[activeIndex]) }
    } else if (event.key === 'Escape') {
      if (showPanel && identifying) { event.preventDefault(); backToResults() }
      else if (showPanel) { event.preventDefault(); setOpen(false) } else if (query) onQueryChange('')
    }
  }

  const activeId = showPanel && options[activeIndex] ? `${listId}-option-${activeIndex}` : undefined

  function optionProps(option: Option, index: number, className: string) {
    return {
      id: `${listId}-option-${index}`,
      role: 'option' as const,
      'aria-selected': index === activeIndex,
      className: `${className}${index === activeIndex ? ' is-active' : ''}`,
      onMouseEnter: () => setActive({ key: viewKey, index }),
      onMouseDown: (event: { preventDefault: () => void }) => event.preventDefault(),
      onClick: () => choose(option),
    }
  }

  function busyFor(key: string) { return resolving?.key === key && !resolving.error }

  const backButton = <button type="button" className="text-button cert-identify-back" onMouseDown={(event) => event.preventDefault()} onClick={backToResults}><ArrowLeft size={15} aria-hidden="true" /> Back to catalog results</button>

  function renderIdentify(state: IdentifyState) {
    if (state.status === 'loading') return <div className="cert-identify-state" role="status" aria-live="polite">
      <div className="loading-state"><LoaderCircle className="spin" size={18} aria-hidden="true" /><span>Searching the web for '{state.key}'…</span></div>
      <p className="cert-identify-hint">This can take up to a minute.</p>
      {backButton}
    </div>
    if (state.status === 'error') {
      const { issue } = state
      return <div className="cert-identify-state">
        {issue.kind === 'key' && <KeyRequiredCallout>Identifying a certification runs with your own OpenAI key. Add it in Settings, then try again.</KeyRequiredCallout>}
        {issue.kind === 'rate' && <div className="alert warning" role="alert">
          <Clock size={16} aria-hidden="true" />
          <div><strong>Too many identify requests.</strong><p>{issue.message || 'Wait a minute, then try again.'}</p></div>
        </div>}
        {issue.kind === 'invalid-key' && <div className="alert error" role="alert">
          <KeyRound size={16} aria-hidden="true" />
          <div><strong>Your OpenAI API key was rejected.</strong><p>{issue.message || 'Check the key in Settings, then try again.'}</p></div>
          <Link className="button button-secondary button-small" to="/settings">Open settings</Link>
        </div>}
        {issue.kind === 'error' && <div className="alert error" role="alert">
          <div><strong>Could not identify the certification.</strong><p>{issue.message}</p></div>
          <button type="button" className="button button-secondary button-small" onMouseDown={(event) => event.preventDefault()} onClick={() => void runIdentify(true)}><RefreshCw size={14} aria-hidden="true" /> Try again</button>
        </div>}
        {backButton}
      </div>
    }
    const { candidates } = state.result
    if (!candidates.length) return <div className="cert-identify-state">
      <p className="cert-identify-empty">The agent could not find a certification matching that. Try the official exam code, or describe it in <Link to="/intake">Help me choose</Link>.</p>
      {backButton}
    </div>
    return <div className="cert-identify-state">
      <p className="cert-identify-heading" id={`${listId}-identify-heading`}>Found on the web for '{state.key}'</p>
      <ul id={listId} role="listbox" aria-labelledby={`${listId}-identify-heading`} className="cert-search-results">
        {options.map((option, index) => {
          if (option.kind !== 'candidate') return null
          const { candidate } = option
          return <li key={option.key} {...optionProps(option, index, 'cert-search-option cert-identify-option')}>
            <span className="provider-logo"><ProviderLogo name={candidate.provider} /></span>
            <span className="cert-identify-text">
              <span className="cert-identify-line">
                <strong>{candidate.code}</strong>
                <small>{candidate.provider}</small>
                <span className={`chip ${confidenceChip[candidate.confidence]}`}>{confidenceLabel[candidate.confidence]}<span className="visually-hidden"> confidence</span></span>
              </span>
              <span className="cert-identify-title">{candidate.title}</span>
              {candidate.note && <small className="cert-identify-note">{candidate.note}</small>}
              {candidate.retired && <span className="cert-identify-retired"><span className="chip chip-warning">{candidate.successorCode ? `Retired, see ${candidate.successorCode}` : 'Retired'}</span></span>}
              {candidate.officialUrl && <a className="cert-identify-link" href={candidate.officialUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>Official page <ExternalLink size={13} aria-hidden="true" /></a>}
            </span>
            {busyFor(option.key) ? <LoaderCircle className="spin" size={16} aria-label="Opening" /> : <ArrowRight className="cert-search-arrow" size={16} aria-hidden="true" />}
          </li>
        })}
      </ul>
      {resolving?.error && <div className="alert error" role="alert">{resolving.error}</div>}
      {backButton}
    </div>
  }

  return <div className="cert-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false) }}>
    <label className="cert-search-field">
      <Search size={18} aria-hidden="true" />
      <span className="visually-hidden">Search certifications by exam code, name or provider</span>
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        autoComplete="off"
        spellCheck={false}
        maxLength={100}
        placeholder="Exam code or name, e.g. AZ-104"
        value={query}
        onChange={(event) => { onQueryChange(event.target.value); setOpen(true); setIdentifyVisible(false) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {loading && <LoaderCircle className="spin" size={18} aria-label="Searching" />}
      {query && !loading && <button type="button" className="icon-button cert-search-clear" aria-label="Clear search" onClick={() => { onQueryChange(''); setIdentifyVisible(false); inputRef.current?.focus() }}><X size={16} /></button>}
    </label>
    {showPanel && <div className="cert-search-panel">
      {identifying ? renderIdentify(identifying) : <>
        {result.error && result.key === trimmed && <div className="alert error" role="alert">{result.error}</div>}
        {!loading && !result.error && result.key === trimmed && !hits.length && canIdentify && <p className="cert-search-nomatch">No match in the catalog yet.</p>}
        <ul id={listId} role="listbox" aria-label="Matching certifications" className="cert-search-results">
          {options.map((option, index) => {
            if (option.kind === 'identify') return <li key={option.key} {...optionProps(option, index, 'cert-search-option cert-search-identify')}>
              <span className="cert-search-identify-icon"><Sparkles size={18} aria-hidden="true" /></span>
              <span className="cert-search-text"><span>Can't find it? Ask the agent to identify it</span></span>
              <ArrowRight className="cert-search-arrow" size={16} aria-hidden="true" />
            </li>
            if (option.kind !== 'hit') return null
            const { hit } = option
            return <li key={option.key} {...optionProps(option, index, 'cert-search-option')}>
              <span className="provider-logo"><ProviderLogo name={hit.provider} /></span>
              <span className="cert-search-text">
                <strong>{hit.code}</strong>
                <span>{hit.title}</span>
                <small>{hit.provider}</small>
              </span>
              {busyFor(option.key) ? <LoaderCircle className="spin" size={16} aria-label="Opening" /> : <FreshnessChip status={hit.briefStatus} />}
              <ArrowRight className="cert-search-arrow" size={16} aria-hidden="true" />
            </li>
          })}
        </ul>
        {resolving?.error && <div className="alert error" role="alert">{resolving.error}</div>}
        {!loading && !result.error && result.key === trimmed && !hits.length && !canIdentify && <div className="cert-search-empty">
          <p>No certification matches <strong>{trimmed}</strong>.</p>
          <p>Try the exam code (for example AZ-104) or the vendor name, or <Link to="/intake">let us help you choose</Link>.</p>
        </div>}
      </>}
    </div>}
  </div>
}
