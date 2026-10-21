import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CircleAlert, Clock, ExternalLink, FileText, LoaderCircle, RotateCcw, Sparkles } from 'lucide-react'
import { usePolling } from '../../hooks/usePolling'
import { ApiError } from '../../lib/api/client'
import { getIntake, selectRecommendation } from '../../lib/api/intake'
import { getJob } from '../../lib/api/jobs'
import type { IntakeRecommendation, IntakeSessionDto } from '../../lib/contracts'
import { useApi } from '../../session'
import { formatDate, message } from '../legacy/utils'
import type { IntakePrefillState } from './IntakePage'
import './intake.css'

const levelLabels: Record<IntakeRecommendation['level'], string> = {
  fundamental: 'Fundamental', associate: 'Associate', professional: 'Professional', specialty: 'Specialty', expert: 'Expert', unknown: 'Level not tiered',
}

function isActive(status: IntakeSessionDto['status'] | undefined) {
  return status === undefined || status === 'QUEUED' || status === 'RUNNING'
}

function safeHttpsUrl(value: string | null) {
  if (!value) return null
  try { return new URL(value).protocol === 'https:' ? value : null } catch { return null }
}

export function IntakeResultPage() {
  const { id = '' } = useParams()
  const request = useApi()
  const navigate = useNavigate()
  // State is keyed by intake id so it resets when the route switches to another intake. The fetcher stores the
  // session itself: stopping the poll (settled) can unmount usePolling's tick before it records `data`.
  const [notFoundId, setNotFoundId] = useState<string | null>(null)
  const [session, setSession] = useState<IntakeSessionDto | null>(null)
  const loadFailed = notFoundId === id
  const current = session?.id === id ? session : null
  const settled = Boolean(current && !isActive(current.status))
  const { error } = usePolling(async () => {
    try {
      const result = await getIntake(request, id)
      setSession(result)
      return result
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 404) setNotFoundId(id)
      throw reason
    }
  }, 2000, Boolean(id) && !loadFailed && !settled)
  const running = !current || isActive(current.status)
  const jobId = current?.jobId ?? null
  const { data: job } = usePolling(() => getJob(request, jobId!), 2000, Boolean(jobId) && running)
  const [selecting, setSelecting] = useState<number | null>(null)
  const [selectError, setSelectError] = useState<string | null>(null)

  async function startStudying(index: number) {
    setSelecting(index)
    setSelectError(null)
    try {
      const { certificationId } = await selectRecommendation(request, id, index)
      navigate(`/certifications/${certificationId}`)
    } catch (reason) {
      setSelectError(message(reason, 'Could not open this certification.'))
      setSelecting(null)
    }
  }

  function refine() {
    const state: IntakePrefillState = { prefillText: current?.inputText ?? '', followUpQuestions: current?.result?.followUpQuestions ?? [] }
    navigate('/intake', { state })
  }

  const header = <header className="topbar">
    <div><p className="breadcrumb">STUDY <span>/</span> <Link to="/intake">HELP ME CHOOSE</Link> <span>/</span> RECOMMENDATIONS</p><h1>Your recommendations</h1></div>
    <Link className="button button-secondary" to="/intake"><ArrowLeft size={14} aria-hidden="true" />New intake</Link>
  </header>

  if (loadFailed) return <div className="page-content intake-page">{header}<div className="empty-state"><h3>Intake not found</h3><p>It may have been removed, or it belongs to someone else.</p><Link className="button button-primary" to="/intake">Start a new intake</Link></div></div>
  if (!current && error) return <div className="page-content intake-page">{header}<div className="alert error" role="alert"><CircleAlert size={15} aria-hidden="true" />{message(error, 'Could not load this intake.')}</div></div>
  if (!current) return <div className="page-content intake-page">{header}<div className="loading-state"><LoaderCircle size={18} className="spin" aria-hidden="true" />Loading...</div></div>

  const inputSummary = <details className="intake-input-summary">
    <summary>What you told us{current.attachments.length > 0 && ` (+ ${current.attachments.length} file${current.attachments.length === 1 ? '' : 's'})`}</summary>
    {current.inputText && <p>{current.inputText}</p>}
    {current.attachments.length > 0 && <ul className="intake-files compact">{current.attachments.map((file) => <li key={file.name}><FileText size={13} aria-hidden="true" /><span className="intake-file-name">{file.name}</span><small>{file.chars.toLocaleString()} characters read</small></li>)}</ul>}
    <small className="muted"><Clock size={11} aria-hidden="true" /> {formatDate(current.createdAt)}</small>
  </details>

  if (running) {
    const log = job?.progress ?? []
    return <div className="page-content intake-page">{header}
      <div className="intake-progress" role="status" aria-live="polite">
        <div className="intake-progress-head"><LoaderCircle size={20} className="spin" aria-hidden="true" /><div><strong>{current.status === 'QUEUED' ? 'Waiting for a free worker...' : 'Matching your profile to certifications...'}</strong><p>This usually takes under a minute. You can leave this page and come back from Previous intakes.</p></div></div>
        {log.length > 0 && <ol className="intake-log">{log.map((entry, index) => <li key={`${entry.at}-${index}`}><time dateTime={entry.at}>{new Date(entry.at).toLocaleTimeString()}</time><span>{entry.message}</span></li>)}</ol>}
      </div>
      {inputSummary}
    </div>
  }

  if (current.status === 'FAILED' || !current.result) {
    return <div className="page-content intake-page">{header}
      <div className="alert error" role="alert"><CircleAlert size={15} aria-hidden="true" /><div><strong>The recommendation did not finish.</strong><p>{current.error ?? 'Something went wrong.'}</p></div></div>
      <div className="intake-actions">
        <button type="button" className="button button-primary" onClick={refine}><RotateCcw size={14} aria-hidden="true" />Try again</button>
        {current.error?.includes('Settings') && <Link className="button button-secondary" to="/settings">Open settings</Link>}
      </div>
      {inputSummary}
    </div>
  }

  const result = current.result
  return <div className="page-content intake-page">{header}
    <section className="intake-profile">
      <p className="eyebrow">YOUR PROFILE</p>
      <p className="intake-profile-summary">{result.profileSummary}</p>
      {result.detectedSkills.length > 0 && <div className="intake-chips" aria-label="Detected skills">{result.detectedSkills.map((skill) => <span key={skill} className="intake-skill">{skill}</span>)}</div>}
      {result.goals.length > 0 && <div className="intake-goals"><strong>Goals</strong><ul>{result.goals.map((goal) => <li key={goal}>{goal}</li>)}</ul></div>}
    </section>

    {selectError && <div className="alert error" role="alert"><CircleAlert size={15} aria-hidden="true" />{selectError}</div>}

    <section aria-labelledby="intake-recs-heading">
      <div className="section-heading"><div><h2 id="intake-recs-heading">Recommended certifications</h2><p>Ranked by fit. Start studying to generate a cited study brief.</p></div></div>
      <ol className="intake-recs">
        {result.recommendations.map((recommendation, index) => {
          const url = safeHttpsUrl(recommendation.officialUrl)
          return <li key={`${recommendation.provider}-${recommendation.code}-${index}`} className="intake-rec">
            <div className="intake-rec-head">
              <span className="intake-rank" aria-label={`Rank ${recommendation.rank}`}>{recommendation.rank}</span>
              <div className="intake-rec-title">
                <span className="intake-rec-meta"><span>{recommendation.provider}</span><span className="intake-code">{recommendation.code}</span><span className={`intake-level intake-level-${recommendation.level}`}>{levelLabels[recommendation.level]}</span></span>
                <h3>{recommendation.title}</h3>
              </div>
            </div>
            <p className="intake-why">{recommendation.whyFit}</p>
            <dl className="intake-facts">
              <div><dt>Estimated prep</dt><dd>{recommendation.estimatedPrepWeeks === null ? 'Not estimated' : `${recommendation.estimatedPrepWeeks} week${recommendation.estimatedPrepWeeks === 1 ? '' : 's'}`}</dd></div>
              <div><dt>Prerequisites</dt><dd>{recommendation.prerequisites.length ? <ul>{recommendation.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul> : 'None listed'}</dd></div>
            </dl>
            {recommendation.matchedSignals.length > 0 && <div className="intake-signals"><span className="eyebrow">MATCHED FROM YOUR INPUT</span><div className="intake-chips">{recommendation.matchedSignals.map((signal) => <span key={signal} className="intake-signal">{signal}</span>)}</div></div>}
            <div className="intake-rec-actions">
              {url && <a className="button button-quiet" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} aria-hidden="true" />Official page</a>}
              <button type="button" className="button button-primary" disabled={selecting !== null} onClick={() => void startStudying(index)}>
                {selecting === index ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : <ArrowRight size={14} aria-hidden="true" />}
                Start studying
              </button>
            </div>
          </li>
        })}
      </ol>
    </section>

    {result.followUpQuestions.length > 0 && <section className="intake-followups">
      <div><Sparkles size={16} aria-hidden="true" /><div><strong>Sharpen these recommendations</strong><p>Answering these would help us suggest a better fit.</p></div></div>
      <ul>{result.followUpQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
      <button type="button" className="button button-secondary" onClick={refine}><RotateCcw size={14} aria-hidden="true" />Refine</button>
    </section>}

    {inputSummary}
  </div>
}
