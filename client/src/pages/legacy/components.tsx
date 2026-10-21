import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import DOMPurify from 'dompurify'
import { ArrowDownToLine, ArrowUpRight, BadgeCheck, Bookmark, BookOpen, Check, CircleHelp, Clock3, FileText, Flag, Link2, LoaderCircle, Plus, ThumbsUp, Trash2, Upload } from 'lucide-react'
import { RichTextEditor } from '../../components/RichTextEditor'
import { reportResource, toggleBookmark, toggleHelpful } from '../../lib/api'
import type { Certification, CertificationInput, Resource, ResourceInput, ResourceKind } from '../../lib/api'
import { useApi } from '../../session'
import { formatDate, labels, message, parseResourceContent } from './utils'

export function CertificationDialog({ existing, onClose, onSaved }: { existing?: Certification; onClose: () => void; onSaved: (item: Certification) => void }) {
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

export function ResourceQuality({ resource }: { resource: Resource }) {
  return <section className="resource-quality" aria-label="Resource quality signals">
    <div className={`resource-quality-review ${resource.isReviewed ? 'is-reviewed' : ''}`}>
      {resource.isReviewed ? <BadgeCheck size={16} aria-hidden="true" /> : <Clock3 size={16} aria-hidden="true" />}
      <div><strong>{resource.isReviewed ? 'Admin reviewed' : 'Not yet reviewed'}</strong><span>{resource.reviewedAt ? <>Last reviewed <time dateTime={resource.reviewedAt}>{formatDate(resource.reviewedAt)}</time></> : 'No administrator review recorded'}</span></div>
    </div>
    <div className="resource-quality-source"><Link2 size={16} aria-hidden="true" /><div><strong>Source</strong>{resource.sourceUrl ? <a href={resource.sourceUrl} target="_blank" rel="noreferrer">{resource.sourceName || resource.sourceUrl}<ArrowUpRight size={12} aria-hidden="true" /></a> : <span>{resource.sourceName || 'Not provided'}</span>}</div></div>
    <div className="resource-quality-helpful"><ThumbsUp size={16} aria-hidden="true" /><div><strong>{resource.helpfulCount} helpful {resource.helpfulCount === 1 ? 'vote' : 'votes'}</strong><span>Community feedback</span></div></div>
  </section>
}

export function ResourceCard({ resource, canEdit, onOpen, onDelete, onDownload, onBookmark, onHelpful }: { resource: Resource; canEdit: boolean; onOpen: () => void; onDelete: () => void; onDownload: () => void; onBookmark: () => void; onHelpful: () => void }) {
  const content = parseResourceContent(resource.content)
  const questionCount = Array.isArray(content.questions) ? content.questions.length : 0
  const fileName = typeof content.originalFileName === 'string' ? content.originalFileName : 'PDF document attached'
  const summary = resource.type === 'QUESTION_SET' ? `${questionCount} study questions` : resource.type === 'RICH_TEXT' ? 'Formatted study notes' : resource.type === 'LINK' ? 'External learning resource' : fileName
  return <article className="resource-card"><header className="resource-card-top"><span className={`resource-type type-${resource.type.toLowerCase()}`}>{resource.type === 'PDF' ? <FileText size={15} /> : resource.type === 'LINK' ? <Link2 size={15} /> : resource.type === 'QUESTION_SET' ? <CircleHelp size={15} /> : <BookOpen size={15} />}{labels[resource.type]}</span><span className="resource-card-tools">{canEdit && <button className="icon-button danger-hover" aria-label={`Remove ${resource.title}`} title="Remove resource" onClick={onDelete}><Trash2 size={15} /></button>}</span></header>
    <button type="button" className="resource-open-button" onClick={onOpen}><span className="resource-open-title">{resource.title}<ArrowUpRight size={15} /></span><span className="resource-summary">{summary}</span><span className="resource-open-hint">Open details</span></button>
    <div className="resource-topic-list">{resource.topics.map((topic) => <span className="topic-chip" key={topic}>{topic}</span>)}</div>
    <ResourceQuality resource={resource} />
    <div className="resource-actions"><button className={`resource-action ${resource.isBookmarked ? 'selected' : ''}`} title={resource.isBookmarked ? 'Remove saved resource' : 'Save resource'} aria-label={resource.isBookmarked ? 'Remove saved resource' : 'Save resource'} onClick={onBookmark}><Bookmark size={15} /> <span>{resource.isBookmarked ? 'Saved' : 'Save'}</span></button><button className={`resource-action ${resource.isHelpful ? 'selected' : ''}`} title={resource.isHelpful ? 'Remove helpful vote' : 'Mark helpful'} aria-pressed={resource.isHelpful} onClick={onHelpful}><ThumbsUp size={15} /> <span>Helpful {resource.helpfulCount}</span></button><span className="resource-format-meta">{resource.language.toUpperCase()}{resource.estimatedMinutes ? ` · ${resource.estimatedMinutes} min` : ''}</span></div>
    {resource.type === 'PDF' && <button className="resource-link" onClick={onDownload}><ArrowDownToLine size={15} /> Download PDF</button>}
    <footer className="resource-card-footer"><span>Added by {resource.createdByName}</span><span>{formatDate(resource.createdAt)}</span></footer>
  </article>
}

export function ResourceDetailDialog({ resource, onClose, onDownload, onChanged }: { resource: Resource; onClose: () => void; onDownload: () => void; onChanged: () => void }) {
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
  const [feedback, setFeedback] = useState({ isHelpful: resource.isHelpful, helpfulCount: resource.helpfulCount })
  const [savingHelpful, setSavingHelpful] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')
  useEffect(() => {
    if (resource.type !== 'PDF') return
    let active = true
    let objectUrl = ''
    request<Blob>(`/api/resources/${resource.id}/file`).then((blob) => { objectUrl = URL.createObjectURL(blob); if (active) setPreviewUrl(objectUrl) }).catch((error: unknown) => { if (active) setPreviewError(message(error, 'PDF preview is unavailable. Use Download PDF instead.')) })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [request, resource.id, resource.type])
  async function markHelpful() {
    setSavingHelpful(true); setFeedbackError('')
    try { const result = await toggleHelpful(request, resource.id); setFeedback({ isHelpful: result.helpful, helpfulCount: result.helpfulCount }); onChanged() }
    catch (error) { setFeedbackError(message(error, 'Could not record feedback.')) }
    finally { setSavingHelpful(false) }
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
    <div className="resource-detail-meta-grid"><span><strong>Language</strong>{resource.language.toUpperCase()}</span>{resource.estimatedMinutes && <span><strong>Study time</strong>{resource.estimatedMinutes} minutes</span>}</div>
    <ResourceQuality resource={{ ...resource, ...feedback }} />
    {resource.topics.length > 0 && <div className="topic-list">{resource.topics.map((topic) => <span className="topic-chip" key={topic}>{topic}</span>)}</div>}
    {resource.type === 'QUESTION_SET' && <div className="question-detail-list">{questions.map((question, index) => <article className="question-detail" key={index}><span>QUESTION {String(index + 1).padStart(2, '0')}</span><h2>{question.question}</h2>{question.answer && <p><strong>Answer</strong>{question.answer}</p>}{question.explanation && <p><strong>Explanation</strong>{question.explanation}</p>}</article>)}</div>}
    {resource.type === 'RICH_TEXT' && <div className="rich-detail" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(typeof content.html === 'string' ? content.html : '') }} />}
    {resource.type === 'LINK' && typeof content.url === 'string' && <a className="button button-primary" href={content.url} target="_blank" rel="noreferrer">Open external resource <ArrowUpRight size={15} /></a>}
    {resource.type === 'PDF' && <div className="pdf-detail"><div className="pdf-detail-head"><FileText size={22} /><div><strong>{fileName}</strong><small>PDF document · {resource.fileSize ? `${(resource.fileSize / 1024 / 1024).toFixed(1)} MB` : 'attached'}</small></div><button className="button button-primary" onClick={onDownload}><ArrowDownToLine size={16} /> Download PDF</button></div>{previewError ? <p className="field-hint">{previewError}</p> : previewUrl ? <iframe className="pdf-preview" title={`PDF preview: ${fileName}`} src={previewUrl} /> : <div className="pdf-preview-loading"><LoaderCircle className="spin" size={18} /> Loading preview</div>}</div>}
    {feedbackError && <div className="alert error" role="alert">{feedbackError}</div>}
    <div className="resource-detail-actions"><button className={`button button-secondary ${resource.isBookmarked ? 'selected' : ''}`} onClick={() => void saveBookmark()}><Bookmark size={15} /> {resource.isBookmarked ? 'Saved' : 'Save for later'}</button><button className={`button button-secondary ${feedback.isHelpful ? 'selected' : ''}`} disabled={savingHelpful} aria-pressed={feedback.isHelpful} title={feedback.isHelpful ? 'Remove helpful vote' : 'Mark helpful'} onClick={() => void markHelpful()}><ThumbsUp size={15} /> Helpful · {feedback.helpfulCount}</button><button className="button button-quiet" onClick={() => setReportOpen((open) => !open)}><Flag size={15} /> Report an issue</button></div>
    {reportStatus && <div className="report-status" role="status">{reportStatus}</div>}{reportOpen && <form className="report-form" onSubmit={submitReport}><label className="field"><span>Issue type</span><select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}><option value="BROKEN_LINK">Broken link or file</option><option value="OUTDATED">Outdated content</option><option value="INCORRECT">Incorrect information</option><option value="RIGHTS_CONCERN">Rights or attribution concern</option><option value="OTHER">Other</option></select></label><label className="field"><span>Details <small>Optional</small></span><textarea rows={2} maxLength={1000} value={reportMessage} onChange={(event) => setReportMessage(event.target.value)} placeholder="What should the reviewer know?" /></label><button disabled={savingReport} className="button button-primary">{savingReport ? 'Sending…' : 'Send report'}</button></form>}
  </div></Modal>
}

export function ResourceDialog({ certification, onClose, onSaved }: { certification: Certification; onClose: () => void; onSaved: () => void }) {
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
export function QuestionSetEditor({ questions, onChange }: { questions: Question[]; onChange: (value: Question[]) => void }) {
  function update(index: number, field: keyof Question, value: string) { onChange(questions.map((question, itemIndex) => itemIndex === index ? { ...question, [field]: value } : question)) }
  return <div className="question-editor"><div className="question-editor-head"><strong>Questions</strong><button type="button" className="text-button" onClick={() => onChange([...questions, { question: '', answer: '', explanation: '' }])}><Plus size={15} /> Add question</button></div>{questions.map((question, index) => <div className="question-block" key={index}><div className="question-block-head"><span>QUESTION {String(index + 1).padStart(2, '0')}</span>{questions.length > 1 && <button type="button" className="icon-button" aria-label="Remove question" onClick={() => onChange(questions.filter((_, itemIndex) => itemIndex !== index))}>×</button>}</div><label className="field"><span>Question</span><textarea required rows={2} value={question.question} onChange={(event) => update(index, 'question', event.target.value)} placeholder="Write a study question" /></label><div className="form-grid"><label className="field"><span>Answer</span><textarea rows={2} value={question.answer} onChange={(event) => update(index, 'answer', event.target.value)} placeholder="Suggested answer" /></label><label className="field"><span>Explanation <small>Optional</small></span><textarea rows={2} value={question.explanation} onChange={(event) => update(index, 'explanation', event.target.value)} placeholder="Why is this the answer?" /></label></div></div>)}</div>
}

export function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal-panel" role="dialog" aria-modal="true"><button className="modal-close" aria-label="Close dialog" onClick={onClose}>×</button>{children}</section></div>
}
