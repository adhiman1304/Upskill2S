import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Cpu, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Server, Trash2 } from 'lucide-react'
import { ApiError } from '../../lib/api/client'
import { deleteOpenAiKey, getOpenAiKeyStatus, saveOpenAiKey } from '../../lib/api/settings'
import type { OpenAiKeyStatusDto } from '../../lib/contracts'
import { useApi } from '../../session'
import { message } from '../legacy/utils'
import './settings.css'

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'unknown' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function SettingsPage() {
  const request = useApi()
  const [status, setStatus] = useState<OpenAiKeyStatusDto | null>(null)
  const [loadError, setLoadError] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    getOpenAiKeyStatus(request)
      .then((data) => { if (active) setStatus(data) })
      .catch((reason: unknown) => { if (active) setLoadError(message(reason, 'Could not load your key settings.')) })
    return () => { active = false }
  }, [request])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = apiKey.trim()
    if (!value) { setError('Paste your OpenAI API key first.'); return }
    setBusy('save'); setError(''); setNotice('')
    try {
      const next = await saveOpenAiKey(request, value)
      setStatus(next)
      setApiKey('')
      setShowKey(false)
      setNotice(`Key saved and validated. Stored key ends in ${next.keyHint ?? '????'}.`)
    } catch (reason) {
      setError(reason instanceof ApiError && reason.code === 'OPENAI_KEY_INVALID' ? reason.message : message(reason, 'Could not save the key.'))
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!window.confirm('Remove your OpenAI API key? Research jobs will stop working until you add a key again.')) return
    setBusy('remove'); setError(''); setNotice('')
    try {
      await deleteOpenAiKey(request)
      setStatus((current) => current && { ...current, configured: false, keyHint: null, lastValidatedAt: null })
      setNotice('Your key was removed.')
    } catch (reason) {
      setError(message(reason, 'Could not remove the key.'))
    } finally {
      setBusy(null)
    }
  }

  return <div className="page-content settings-page">
    <header className="topbar"><div><p className="breadcrumb">ACCOUNT <span>/</span> SETTINGS</p><h1>Settings</h1></div></header>
    {loadError && <div className="alert error" role="alert">{loadError}</div>}
    {!status && !loadError ? <div className="loading-state"><LoaderCircle className="spin" size={20} /> Loading settings</div> : <div className="settings-grid">
      <section className="settings-card" aria-labelledby="openai-key-heading">
        <div className="settings-card-heading">
          <span className="settings-icon"><KeyRound size={18} aria-hidden="true" /></span>
          <div><h2 id="openai-key-heading">OpenAI API key (bring your own)</h2><p>Study briefs and recommendations are researched with your own OpenAI key.</p></div>
        </div>

        <div className={`key-status ${status?.configured ? 'is-set' : 'is-missing'}`} role="status">
          {status?.configured
            ? <><CheckCircle2 size={16} aria-hidden="true" /><span>Key configured, ending in <code>{status.keyHint}</code>{status.lastValidatedAt && <> · last validated {formatDateTime(status.lastValidatedAt)}</>}</span></>
            : <><KeyRound size={16} aria-hidden="true" /><span>No key configured yet. Add one to generate study briefs.</span></>}
        </div>

        <form className="key-form" onSubmit={save} noValidate>
          <label className="field">
            <span>{status?.configured ? 'Replace key' : 'API key'}</span>
            <span className="key-input">
              <input
                type={showKey ? 'text' : 'password'}
                name="openai-api-key"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-..."
                value={apiKey}
                maxLength={400}
                aria-invalid={Boolean(error) || undefined}
                aria-describedby="key-help"
                onChange={(event) => { setApiKey(event.target.value); setError('') }}
              />
              <button type="button" className="key-toggle" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? 'Hide key' : 'Show key'} aria-pressed={showKey}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </span>
          </label>
          {error && <div className="alert error" role="alert">{error}</div>}
          {notice && <div className="settings-notice" role="status"><CheckCircle2 size={15} aria-hidden="true" /> {notice}</div>}
          <div className="key-actions">
            <button type="submit" className="button button-primary" disabled={busy !== null || !apiKey.trim()}>{busy === 'save' ? <><LoaderCircle className="spin" size={15} /> Validating</> : 'Save key'}</button>
            {status?.configured && <button type="button" className="button button-secondary key-remove" onClick={() => void remove()} disabled={busy !== null}>{busy === 'remove' ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />} Remove key</button>}
          </div>
        </form>

        <p id="key-help" className="key-note"><LockKeyhole size={14} aria-hidden="true" /> We check the key with OpenAI before saving. It is encrypted at rest, only used for research jobs you start, and never shown again; only its last four characters are kept for display.</p>
      </section>

      {status && <section className="settings-card" aria-labelledby="models-heading">
        <div className="settings-card-heading">
          <span className="settings-icon"><Cpu size={18} aria-hidden="true" /></span>
          <div><h2 id="models-heading">Models</h2><p>Configured by the server administrator.</p></div>
        </div>
        <dl className="model-list">
          <div><dt>Research</dt><dd><code>{status.models.research}</code><small>Web research, study brief structuring and intake recommendations</small></dd></div>
          <div><dt>Fast</dt><dd><code>{status.models.fast}</code><small>Reserved for quick tasks; not used by any job yet</small></dd></div>
        </dl>
        <p className="server-key-line"><Server size={14} aria-hidden="true" /> {status.serverKeyAvailable ? 'A company key is configured for scheduled refreshes.' : 'No company key is configured, so stale briefs are not refreshed automatically.'}</p>
      </section>}
    </div>}
  </div>
}
