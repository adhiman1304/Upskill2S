import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, CircleAlert, Clock, FileText, KeyRound, LoaderCircle, Mic, MicOff, Paperclip, Sparkles, X } from 'lucide-react'
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

const examples = [
  "I'm a cloud engineer on the bench. I have AZ-104 and want to move toward data engineering within six months.",
  "I'm a junior developer (2 years of TypeScript and Node.js) and want my first cloud certification. Our company uses AWS.",
  "I'm a network administrator moving into security. I know Cisco routing and switching and have about 5 hours a week to study.",
  "I'm a project manager in an IT consultancy and want a certification that clients recognize, ideally covering agile delivery.",
]

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
  const [dragging, setDragging] = useState(false)
  const [history, setHistory] = useState<IntakeSessionDto[] | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
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

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files)
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
    <header className="topbar"><div><p className="breadcrumb">STUDY <span>/</span> HELP ME CHOOSE</p><h1>Help me choose a certification</h1></div></header>
    <p className="intake-lede">Tell us where you are and where you want to go. Type, dictate, or attach a resume, project description or job offer, and we will suggest certifications that fit.</p>

    {keyMissing && <div className="intake-callout" role="alert">
      <KeyRound size={16} aria-hidden="true" />
      <div><strong>Add your OpenAI API key first.</strong><p>Recommendations run with your own OpenAI key. Add it in Settings, then submit again. Your text and files are still here.</p></div>
      <Link className="button button-primary" to="/settings">Open settings</Link>
    </div>}

    {followUps.length > 0 && <div className="intake-followups-hint">
      <p className="eyebrow">ANSWER THESE TO REFINE YOUR RESULTS</p>
      <ul>{followUps.map((question) => <li key={question}>{question}</li>)}</ul>
    </div>}

    <form className="intake-form" onSubmit={(event) => void submit(event)}>
      <label className="intake-text-field">
        <span className="sr-only">Your background and goals</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={MAX_TEXT_CHARS}
          rows={8}
          placeholder="I'm a cloud engineer on the bench, I have AZ-104 and want to move toward data engineering... Mention your current role, experience, certifications you hold, where you want to go, and how much time you have."
        />
        {dictation.listening && dictation.interimText && <span className="intake-interim" aria-live="polite">{dictation.interimText}</span>}
      </label>

      <div className="intake-toolbar">
        {dictation.supported
          ? <button type="button" className={`button ${dictation.listening ? 'button-primary intake-mic-live' : 'button-secondary'}`} onClick={dictation.listening ? dictation.stop : dictation.start} aria-pressed={dictation.listening}>
              {dictation.listening ? <MicOff size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
              {dictation.listening ? 'Stop dictation' : 'Dictate'}
            </button>
          : <span className="intake-note"><MicOff size={14} aria-hidden="true" />Voice dictation is not supported in this browser.</span>}
        {dictation.listening && <span className="intake-listening" role="status"><span className="intake-pulse" aria-hidden="true" />Listening...</span>}
        <span className="intake-count">{text.length.toLocaleString()} / {MAX_TEXT_CHARS.toLocaleString()}</span>
      </div>
      {dictation.error && <p className="intake-inline-error" role="alert">{dictation.error}</p>}

      <div className="intake-examples" aria-label="Example prompts">
        <span className="eyebrow">TRY AN EXAMPLE</span>
        <div>{examples.map((example) => <button type="button" key={example} className="intake-chip" onClick={() => setText(example)} title={example}>{example.length > 64 ? `${example.slice(0, 62)}...` : example}</button>)}</div>
      </div>

      <div
        className={`intake-drop${dragging ? ' dragging' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Paperclip size={18} aria-hidden="true" />
        <div>
          <strong>Drop files here or <button type="button" className="intake-link-button" onClick={() => fileInput.current?.click()}>browse</button></strong>
          <small>Resume, project description or job offer. Up to {MAX_FILES} PDF, DOCX or TXT files, {formatBytes(MAX_FILE_BYTES)} each.</small>
        </div>
        <input ref={fileInput} type="file" multiple accept={ACCEPTED_EXTENSIONS.join(',')} hidden onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = '' }} />
      </div>
      {fileError && <p className="intake-inline-error" role="alert">{fileError}</p>}
      {files.length > 0 && <ul className="intake-files">
        {files.map((file) => <li key={`${file.name}-${file.size}`}>
          <FileText size={15} aria-hidden="true" />
          <span className="intake-file-name">{file.name}</span>
          <small>{formatBytes(file.size)}</small>
          <button type="button" className="icon-button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((item) => item !== file))}><X size={14} /></button>
        </li>)}
      </ul>}

      {error && <div className="alert error" role="alert"><CircleAlert size={15} aria-hidden="true" />{error}</div>}

      <div className="intake-submit">
        <p className="muted">Your input is sent to OpenAI with your key. Avoid personal details you would not put on a resume.</p>
        <button type="submit" className="button button-primary" disabled={!canSubmit}>
          {submitting ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
          {submitting ? 'Starting...' : 'Recommend certifications'}
        </button>
      </div>
    </form>

    <section className="intake-history" aria-labelledby="intake-history-heading">
      <div className="section-heading"><div><h2 id="intake-history-heading">Previous intakes</h2><p>Your last 10 recommendation requests.</p></div></div>
      {historyError && <div className="alert error"><CircleAlert size={15} aria-hidden="true" />{historyError}</div>}
      {!history && !historyError && <p className="muted">Loading...</p>}
      {history?.length === 0 && <p className="muted">No previous intakes yet.</p>}
      {history && history.length > 0 && <ul className="intake-history-list">
        {history.map((item) => <li key={item.id}>
          <Link to={`/intake/${item.id}`}>
            <span className="intake-history-text">{item.inputText || item.attachments.map((file) => file.name).join(', ') || 'Untitled intake'}</span>
            <span className="intake-history-meta">
              <span className={`intake-status intake-status-${item.status.toLowerCase()}`}>{statusLabels[item.status]}</span>
              {item.result && <small>{item.result.recommendations.length} recommendations</small>}
              <small><Clock size={11} aria-hidden="true" /> {formatDate(item.createdAt)}</small>
              <ArrowRight size={14} aria-hidden="true" />
            </span>
          </Link>
        </li>)}
      </ul>}
    </section>
  </div>
}
