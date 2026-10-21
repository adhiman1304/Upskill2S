import { useEffect, useId, useState, type KeyboardEvent, type RefObject } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, LoaderCircle, Search, X } from 'lucide-react'
import { resolveCertification, searchCatalog } from '../../lib/api/catalog'
import type { CatalogHitDto } from '../../lib/contracts'
import { useApi } from '../../session'
import { ProviderLogo } from '../legacy/providers'
import { message } from '../legacy/utils'
import { FreshnessChip } from './FreshnessChip'

const DEBOUNCE_MS = 250

function hitKey(hit: CatalogHitDto) { return hit.certificationId ?? `catalog:${hit.provider}:${hit.code}` }

/** Typeahead over GET /api/catalog/search. Selecting a catalog-only hit resolves it into a certification first. */
export function CertificationSearch({ query, onQueryChange, inputRef }: { query: string; onQueryChange: (value: string) => void; inputRef: RefObject<HTMLInputElement | null> }) {
  const request = useApi()
  const navigate = useNavigate()
  const listId = useId()
  const trimmed = query.trim()
  const [result, setResult] = useState<{ key: string; hits: CatalogHitDto[]; error: string }>({ key: '', hits: [], error: '' })
  const [active, setActive] = useState<{ key: string; index: number }>({ key: '', index: 0 })
  const [open, setOpen] = useState(false)
  const [resolving, setResolving] = useState<{ key: string; error: string } | null>(null)

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

  const loading = Boolean(trimmed) && result.key !== trimmed
  const hits = trimmed && result.key === trimmed ? result.hits : []
  const activeIndex = active.key === result.key ? Math.min(active.index, Math.max(hits.length - 1, 0)) : 0
  const showPanel = open && Boolean(trimmed)

  async function select(hit: CatalogHitDto) {
    if (hit.certificationId) { navigate(`/certifications/${encodeURIComponent(hit.certificationId)}`); return }
    const key = hitKey(hit)
    setResolving({ key, error: '' })
    try {
      const { id } = await resolveCertification(request, { provider: hit.provider, code: hit.code, title: hit.title, officialUrl: hit.officialUrl })
      navigate(`/certifications/${encodeURIComponent(id)}`)
    } catch (reason) {
      setResolving({ key, error: message(reason, 'Could not open this certification.') })
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (!hits.length) return
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActive({ key: result.key, index: (activeIndex + delta + hits.length) % hits.length })
    } else if (event.key === 'Enter') {
      if (showPanel && hits[activeIndex]) { event.preventDefault(); void select(hits[activeIndex]) }
    } else if (event.key === 'Escape') {
      if (showPanel) { event.preventDefault(); setOpen(false) } else if (query) onQueryChange('')
    }
  }

  const activeId = showPanel && hits[activeIndex] ? `${listId}-option-${activeIndex}` : undefined

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
        onChange={(event) => { onQueryChange(event.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {loading && <LoaderCircle className="spin" size={18} aria-label="Searching" />}
      {query && !loading && <button type="button" className="icon-button cert-search-clear" aria-label="Clear search" onClick={() => { onQueryChange(''); inputRef.current?.focus() }}><X size={16} /></button>}
    </label>
    {showPanel && <div className="cert-search-panel">
      {result.error && result.key === trimmed && <div className="alert error" role="alert">{result.error}</div>}
      <ul id={listId} role="listbox" aria-label="Matching certifications" className="cert-search-results">
        {hits.map((hit, index) => {
          const key = hitKey(hit)
          const busy = resolving?.key === key && !resolving.error
          return <li
            key={key}
            id={`${listId}-option-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            className={`cert-search-option${index === activeIndex ? ' is-active' : ''}`}
            onMouseEnter={() => setActive({ key: result.key, index })}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void select(hit)}
          >
            <span className="provider-logo"><ProviderLogo name={hit.provider} /></span>
            <span className="cert-search-text">
              <strong>{hit.code}</strong>
              <span>{hit.title}</span>
              <small>{hit.provider}</small>
            </span>
            {busy ? <LoaderCircle className="spin" size={16} aria-label="Opening" /> : <FreshnessChip status={hit.briefStatus} />}
            <ArrowRight className="cert-search-arrow" size={16} aria-hidden="true" />
          </li>
        })}
      </ul>
      {resolving?.error && <div className="alert error" role="alert">{resolving.error}</div>}
      {!loading && !result.error && result.key === trimmed && !hits.length && <div className="cert-search-empty">
        <p>No certification matches <strong>{trimmed}</strong>.</p>
        <p>Try the exam code (for example AZ-104) or the vendor name, or <Link to="/intake">let us help you choose</Link>.</p>
      </div>}
    </div>}
  </div>
}
