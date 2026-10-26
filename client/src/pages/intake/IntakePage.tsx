import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, CircleAlert, Clock, FileText, LoaderCircle, Mic, MicOff, Paperclip, Sparkles, X } from 'lucide-react'
import { KeyRequiredCallout } from '../../components/ui/KeyRequiredCallout'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useSpeechDictation } from '../../hooks/useSpeechDictation'
import { ApiError } from '../../lib/api/client'
import { createIntake, listMyIntakes } from '../../lib/api/intake'
import type { IntakeSessionDto } from '../../lib/contracts'
import { useApi } from '../../session'
import { formatDate, message } from '../legacy/utils'
import './intake.css'

const MAX_FILES = 3
const MAX_FILE_BYTES = 10 * 1024 * 1024
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md']
const MAX_TEXT_CHARS = 20_000

const EXAMPLE = 'Cloud engineer with AZ-104, moving toward data engineering'

export interface IntakePrefillState { prefillText?: string; followUpQuestions?: string[] }

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function extensionOf(name: string) {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLocaleLowerCase() : ''
}

const statusLabels: Record<IntakeSessionDto['status'], string> = { QUEUED: 'Queued', RUNNING: 'Running', SUCCEEDED: 'Ready', FAILED: 'Failed' }

export function IntakePage() {
  useDocumentTitle('Help me choose')
  const request = useApi()
  const navigate = useNavigate()
  const location = useLocation()
  const prefill = (location.state ?? null) as IntakePrefillState | null
  const [text, setText] = useState(prefill?.prefillText ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keyMissing, setKeyMissing] = useState(false)
  const [history, setHistory] = useState<IntakeSessionDto[] | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const textArea = useRef<HTMLTextAreaElement>(null)
  const followUps = prefill?.followUpQuestions ?? []

  const dictation = useSpeechDictation((transcript) => {
    setText((current) => (current && !/\s$/.test(current) ? `${current} ${transcript}` : `${current}${transcript}`))
  })

  useEffect(() => {
    let active = true
    listMyIntakes(request)
      .then((items) => { if (active) setHistory(items) })
      .catch((reason: unknown) => { if (active) setHistoryError(message(reason, 'Could not load previous intakes.')) })
    return () => { active = false }
  }, [request])

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list)
    const accepted: File[] = []
    const problems: string[] = []
    for (const file of incoming) {
      if (!ACCEPTED_EXTENSIONS.includes(extensionOf(file.name))) problems.push(`${file.name} is not a PDF, DOCX, TXT or Markdown file.`)
      else if (file.size > MAX_FILE_BYTES) problems.push(`${file.name} is larger than ${formatBytes(MAX_FILE_BYTES)}.`)
      else if (file.size === 0) problems.push(`${file.name} is empty.`)
      else accepted.push(file)
    }
    setFiles((current) => {
      const merged = [...current]
      for (const file of accepted) if (!merged.some((existing) => existing.name === file.name && existing.size === file.size)) merged.push(file)
      if (merged.length > MAX_FILES) problems.push(`You can attach up to ${MAX_FILES} files.`)
      return merged.slice(0, MAX_FILES)
    })
    setFileError(problems.length ? problems.join(' ') : null)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    if (dictation.listening) dictation.stop()
    if (!text.trim() && !files.length) { setError('Describe your background and goals, or attach a file.'); return }
    setSubmitting(true)
    setError(null)
    setKeyMissing(false)
    try {
      const session = await createIntake(request, { text: text.trim(), files })
      navigate(`/intake/${session.id}`)
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'OPENAI_KEY_MISSING') setKeyMissing(true)
      else setError(message(reason, 'Could not start the recommendation.'))
      setSubmitting(false)
    }
  }

  const canSubmit = (text.trim().length > 0 || files.length > 0) && !submitting

  return <div className="page-content intake-page">
    <header className="page-header"><div><h1 id="intake-question">Tell us where you are and where you want to go</h1></div></header>

    {keyMissing && <KeyRequiredCallout className="intake-callout">Recommendations run with your own OpenAI key. Add it in Settings, then submit again. Your text and files are still here.</KeyRequiredCallout>}
    {followUps.length > 0 && <div className="alert intake-followups-hint">
      <strong>Answer these to refine your results</strong>
      <ul>{followUps.map((question) => <li key={question}>{question}</li>)}</ul>
    </div>}

    <form className="intake-form" onSubmit={(event) => void submit(event)}>
      <div className="intake-text-field">
        <textarea
          ref={textArea}
          aria-labelledby="intake-question"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={MAX_TEXT_CHARS}
          rows={7}
          placeholder="Your current role and experience, certifications you hold, where you want to go, and how much time you have."
        />
        {dictation.supported && <button
          type="button"
          className={`intake-mic${dictation.listening ? ' is-live' : ''}`}
          onClick={dictation.listening ? dictation.stop : dictation.start}
          aria-pressed={dictation.listening}
          aria-label={dictation.listening ? 'Stop dictation' : 'Dictate'}
          title={dictation.listening ? 'Stop dictation' : 'Dictate'}
        >{dictation.listening ? <MicOff size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}</button>}
      </div>
      {dictation.listening && <p className="intake-listening" role="status"><span className="intake-pulse" aria-hidden="true" />Listening...{dictation.interimText && <span className="intake-interim"> {dictation.interimText}</span>}</p>}
      {dictation.error && <p className="intake-inline-error" role="alert">{dictation.error}</p>}

      <button type="button" className="intake-try" onClick={() => { setText(EXAMPLE); textArea.current?.focus() }}>Try: <span>'{EXAMPLE}'</span></button>

      {files.length > 0 && <ul className="intake-files" aria-label="Attached files">
        {files.map((file) => <li key={`${file.name}-${file.size}`}>
          <FileText size={15} aria-hidden="true" />
          <span className="intake-file-name">{file.name}</span>
          <small>{formatBytes(file.size)}</small>
          <button type="button" className="icon-button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((item) => item !== file))}><X size={14} /></button>
        </li>)}
      </ul>}
      {fileError && <p className="intake-inline-error" role="alert">{fileError}</p>}
      {error && <div className="alert error" role="alert"><CircleAlert size={15} aria-hidden="true" />{error}</div>}

      <div className="intake-actions-row">
        <button type="button" className="button button-secondary" onClick={() => fileInput.current?.click()} disabled={files.length >= MAX_FILES}>
          <Paperclip size={15} aria-hidden="true" />Attach resume or project brief
        </button>
        <input ref={fileInput} type="file" multiple accept={ACCEPTED_EXTENSIONS.join(',')} hidden onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = '' }} />
        <button type="submit" className="button button-primary" disabled={!canSubmit}>
          {submitting ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
          {submitting ? 'Starting...' : 'Get recommendations'}
        </button>
      </div>
      <p className="intake-privacy">Sent to OpenAI with your key. Up to {MAX_FILES} PDF, DOCX, TXT or Markdown files, {MAX_FILE_BYTES / 1024 / 1024} MB each.</p>
    </form>

    <details className="disclosure intake-history-toggle">
      <summary>Previous intakes</summary>
      {historyError && <div className="alert error"><CircleAlert size={15} aria-hidden="true" />{historyError}</div>}
      {!history && !historyError && <p className="muted">Loading...</p>}
      {history?.length === 0 && <p className="muted">No previous intakes yet.</p>}
      {history && history.length > 0 && <ul className="list intake-history-list">
        {history.map((item) => <li key={item.id}>
          <Link to={`/intake/${item.id}`}>
            <span className="intake-history-text">{item.inputText || item.attachments.map((file) => file.name).join(', ') || 'Untitled intake'}</span>
            <span className="intake-history-meta">
              <span className={`chip intake-status-${item.status.toLowerCase()}`}>{statusLabels[item.status]}</span>
              {item.result && <small>{item.result.recommendations.length} recommendations</small>}
              <small><Clock size={11} aria-hidden="true" /> {formatDate(item.createdAt)}</small>
              <ArrowRight size={14} aria-hidden="true" />
            </span>
          </Link>
        </li>)}
      </ul>}
    </details>
  </div>
}
