import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { AlertTriangle, ArrowRight, BookOpen, ClipboardCheck, ClipboardList, ExternalLink, FileText, FolderGit2, GraduationCap, Headphones, History, Link2, ListChecks, MessagesSquare, MonitorPlay, Newspaper, Presentation, Route, Video } from 'lucide-react'
import type { CommunityResource, KnownGap, LearningPathItem, StudyBriefDto } from '../../lib/contracts'
import { Tabs } from '../../components/ui/Tabs'
import { useTabParam } from '../../hooks/useTabParam'
import { formatDate } from '../legacy/utils'
import { formatMinutes, safeUrl } from './brief-utils'
import { ChecklistSection } from './ChecklistSection'
import { ItemMeta, Recommended, SourcesButton } from './FeedbackControl'

const resourceIcons: Record<CommunityResource['kind'], typeof Video> = { video: Video, course: GraduationCap, blog: Newspaper, practice_questions: ListChecks, github: FolderGit2, podcast: Headphones, forum: MessagesSquare, other: Link2 }
const resourceLabels: Record<CommunityResource['kind'], string> = { video: 'Video', course: 'Course', blog: 'Blog', practice_questions: 'Practice questions', github: 'GitHub', podcast: 'Podcast', forum: 'Forum', other: 'Link' }
const pathIcons: Record<LearningPathItem['type'], typeof Video> = { learning_path: Route, module: BookOpen, docs: FileText, practice_assessment: ClipboardCheck, instructor_led: Presentation, exam_sandbox: MonitorPlay, other: Link2 }
const pathLabels: Record<LearningPathItem['type'], string> = { learning_path: 'Learning path', module: 'Module', docs: 'Docs', practice_assessment: 'Practice assessment', instructor_led: 'Instructor-led', exam_sandbox: 'Exam sandbox', other: 'Link' }
const confidenceLabels: Record<KnownGap['confidence'], string> = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' }

const tabIds = ['summary', 'exam', 'checklist', 'gaps', 'resources'] as const
type TabId = (typeof tabIds)[number]
const TABS_ANCHOR = 'brief-tabs'

interface BriefBodyProps {
  brief: StudyBriefDto
  completedItemIds: string[]
  onToggle: (itemId: string, completed: boolean) => void
  onOpenVersions: () => void
}

/** The brief in five tabs at every width: Summary (default), Exam, Checklist, Gaps, Resources. Synced to `?tab=`. */
export function BriefBody({ brief, completedItemIds, onToggle, onOpenVersions }: BriefBodyProps) {
  const { content } = brief
  const [active, select] = useTabParam(tabIds, 'summary')
  const focusTabOnSwitch = useRef(false)

  // After an in-page link switched tabs, move focus to the newly selected tab (the link itself is gone).
  useEffect(() => {
    if (!focusTabOnSwitch.current) return
    focusTabOnSwitch.current = false
    document.querySelector<HTMLElement>(`#${TABS_ANCHOR} [role="tab"][aria-selected="true"]`)?.focus({ preventScroll: true })
  }, [active])

  /** In-page links to another tab: switch, then bring the tab row to the top. */
  function goTo(tab: TabId) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault()
      if (tab === active) return
      focusTabOnSwitch.current = true
      select(tab)
      const marker = document.querySelector(`#${TABS_ANCHOR} .tabs-sentinel`)
      const row = document.querySelector<HTMLElement>(`#${TABS_ANCHOR} .tabs`)
      if (!marker || !row) return
      const offset = parseFloat(getComputedStyle(row).top) || 0
      const top = marker.getBoundingClientRect().top + window.scrollY - offset
      if (window.scrollY > top) window.scrollTo({ top })
    }
  }

  const done = content.checklist.filter((item) => completedItemIds.includes(item.id)).length

  return <div className="brief-body" id={TABS_ANCHOR}>
    <Tabs mode="tabs" label="Study brief sections" defaultTab="summary" className="brief-tabs" tabs={[
      { id: 'summary', label: 'Summary', icon: <FileText size={16} aria-hidden="true" />, content: <SummaryTab brief={brief} done={done} goTo={goTo} onOpenVersions={onOpenVersions} /> },
      { id: 'exam', label: 'Exam', icon: <ClipboardList size={16} aria-hidden="true" />, content: <ExamTab brief={brief} /> },
      { id: 'checklist', label: 'Checklist', icon: <ListChecks size={16} aria-hidden="true" />, content: <ChecklistSection items={content.checklist} completedItemIds={completedItemIds} onToggle={onToggle} /> },
      { id: 'gaps', label: 'Gaps', icon: <AlertTriangle size={16} aria-hidden="true" />, content: <GapsTab gaps={content.knownGaps} /> },
      { id: 'resources', label: 'Resources', icon: <BookOpen size={16} aria-hidden="true" />, content: <ResourcesTab brief={brief} /> },
    ]} />
  </div>
}

function SummaryTab({ brief, done, goTo, onOpenVersions }: { brief: StudyBriefDto; done: number; goTo: (tab: TabId) => (event: MouseEvent<HTMLAnchorElement>) => void; onOpenVersions: () => void }) {
  const { content } = brief
  const notices = [content.certification.retirementNotice, ...content.warnings].filter((value): value is string => Boolean(value))
  const total = content.checklist.length
  return <div className="brief-tab-stack">
    <section className="brief-section brief-summary" aria-labelledby="brief-summary-heading">
      <h2 id="brief-summary-heading" className="sr-only">Summary</h2>
      <p className="brief-summary-text">{content.summary}</p>
      {notices.length > 0 && <ul className="brief-warnings">{notices.map((warning, index) => <li key={index} className="alert warning"><AlertTriangle size={14} aria-hidden="true" /> {warning}</li>)}</ul>}
    </section>
    <nav className="brief-start" aria-labelledby="brief-start-heading">
      <h2 id="brief-start-heading">Where to start</h2>
      <ul>
        <StartLink href="?tab=exam" onClick={goTo('exam')} icon={<ClipboardList size={20} aria-hidden="true" />} title="Read how the exam works" detail="Format, cost, passing score and the skills measured." />
        <StartLink primary href="?tab=checklist" onClick={goTo('checklist')} icon={<ListChecks size={20} aria-hidden="true" />}
          title={done > 0 && done < total ? 'Continue the checklist' : 'Start the checklist'}
          detail={total ? `${done} of ${total} steps done. A step-by-step plan from orientation to exam day.` : 'A step-by-step plan from orientation to exam day.'} />
        <StartLink href="?tab=gaps" onClick={goTo('gaps')} icon={<AlertTriangle size={20} aria-hidden="true" />} title="See what the official material misses" detail={content.knownGaps.length ? `${content.knownGaps.length} known gaps reported by candidates.` : 'Where candidates say the official material falls short.'} />
      </ul>
    </nav>
    <footer className="brief-about" aria-label="About this brief">
      <h2>About this brief</h2>
      <p>
        Generated {formatDate(brief.generatedAt)} with {brief.model}
        <span aria-hidden="true"> · </span>
        <button type="button" className="text-button" onClick={onOpenVersions}><History size={13} aria-hidden="true" />Version {brief.version}</button>
        <span aria-hidden="true"> · </span>
        <a href="?tab=resources" onClick={goTo('resources')}>{brief.sourceCount} sources</a>
      </p>
    </footer>
  </div>
}

function StartLink({ href, onClick, icon, title, detail, primary }: { href: string; onClick: (event: MouseEvent<HTMLAnchorElement>) => void; icon: ReactNode; title: string; detail: string; primary?: boolean }) {
  return <li>
    <a className={`brief-start-link${primary ? ' is-primary' : ''}`} href={href} onClick={onClick}>
      <span className="brief-start-icon">{icon}</span>
      <span className="brief-start-text"><strong>{title}</strong><span>{detail}</span></span>
      <ArrowRight className="brief-start-arrow" size={18} aria-hidden="true" />
    </a>
  </li>
}

function ExamTab({ brief }: { brief: StudyBriefDto }) {
  const { examFormat, certification, skillsMeasured } = brief.content
  const facts = [
    { label: 'Duration', value: examFormat.durationMinutes !== null ? `${examFormat.durationMinutes} min` : null },
    { label: 'Questions', value: examFormat.questionCount },
    { label: 'Passing score', value: examFormat.passingScore },
    { label: 'Cost', value: examFormat.cost },
    { label: 'Delivery', value: examFormat.deliveryOptions.join(', ') || null },
    { label: 'Languages', value: examFormat.languages.length ? (examFormat.languages.length > 3 ? `${examFormat.languages.slice(0, 3).join(', ')} +${examFormat.languages.length - 3}` : examFormat.languages.join(', ')) : null, title: examFormat.languages.join(', ') },
    { label: 'Exam version', value: certification.examVersion },
    { label: 'Last official update', value: certification.lastOfficialUpdate ? formatDate(certification.lastOfficialUpdate) : null },
  ].filter((fact) => fact.value)
  return <div className="brief-tab-stack">
    {(facts.length > 0 || examFormat.notes) && <section className="brief-section brief-facts" aria-labelledby="brief-facts-heading">
      <h2 id="brief-facts-heading">The exam</h2>
      {facts.length > 0 && <dl>{facts.map((fact) => <div key={fact.label} title={fact.title}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
      {examFormat.notes && <p className="brief-facts-note">{examFormat.notes}</p>}
    </section>}
    {skillsMeasured.length > 0 && <section className="brief-section" aria-labelledby="brief-skills-heading">
      <div className="section-heading"><div><h2 id="brief-skills-heading">Skills measured</h2><p>Weights from the official skills outline.</p></div></div>
      <ul className="brief-skills">
        {skillsMeasured.map((skill) => <li key={skill.id}>
          <div className="brief-skill-head"><span className="brief-item-title">{skill.title}</span><span className="brief-skill-side"><SourcesButton ids={skill.sourceIds} />{skill.weightPercent !== null && <strong>{skill.weightPercent}%</strong>}</span></div>
          {skill.weightPercent !== null && <span className="brief-weight-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, skill.weightPercent))}%` }} /></span>}
          {skill.subtopics.length > 0 && <ul className="brief-subtopics">{skill.subtopics.map((topic, index) => <li key={index}>{topic}</li>)}</ul>}
        </li>)}
      </ul>
    </section>}
    {!facts.length && !examFormat.notes && !skillsMeasured.length && <p className="brief-tab-empty">This brief has no exam details.</p>}
  </div>
}

function GapsTab({ gaps }: { gaps: KnownGap[] }) {
  if (!gaps.length) return <p className="brief-tab-empty">No known gaps were reported for this exam.</p>
  return <section className="brief-section" aria-labelledby="brief-gaps-heading">
    <div className="section-heading"><div><h2 id="brief-gaps-heading">Known gaps</h2><p>Where candidates say the official material falls short.</p></div></div>
    <ul className="brief-gaps">
      {gaps.map((gap) => <li key={gap.id} className="brief-gap">
        <h3>{gap.title}</h3>
        <p>{gap.detail}</p>
        <p className="brief-gap-recommendation"><strong>Do this:</strong> {gap.recommendation}</p>
        <ItemMeta itemType="gap" itemId={gap.id} title={gap.title} sourceIds={gap.sourceIds}>
          <span className={`chip brief-confidence-${gap.confidence}`}>{confidenceLabels[gap.confidence]}</span>
          <Recommended itemType="gap" itemId={gap.id} />
        </ItemMeta>
      </li>)}
    </ul>
  </section>
}

function ResourcesTab({ brief }: { brief: StudyBriefDto }) {
  const { content } = brief
  const hasLinks = content.officialLearningPath.length > 0 || content.communityResources.length > 0
  return <div className="brief-tab-stack">
    {content.officialLearningPath.length > 0 && <LinkListSection title="Official learning path" description="From the exam provider." itemType="learning_path"
      items={content.officialLearningPath.map((item) => ({ id: item.id, title: item.title, url: item.url, Icon: pathIcons[item.type], kindLabel: pathLabels[item.type], detail: item.notes, meta: formatMinutes(item.estimatedMinutes), sourceIds: item.sourceIds }))} />}
    {content.communityResources.length > 0 && <LinkListSection title="Community resources" description="Recommended by the community; not official." itemType="resource"
      items={content.communityResources.map((item) => ({ id: item.id, title: item.title, url: item.url, Icon: resourceIcons[item.kind], kindLabel: resourceLabels[item.kind], detail: item.whyRecommended, meta: [item.author, item.publishedAt ? formatDate(item.publishedAt) : null].filter(Boolean).join(' · '), sourceIds: item.sourceIds }))} />}
    {!hasLinks && <p className="brief-tab-empty">No learning path or community resources in this brief.</p>}
    <SourcesList brief={brief} />
  </div>
}

interface LinkListItem { id: string; title: string; url: string; Icon: typeof Video; kindLabel: string; detail: string | null; meta: string; sourceIds: string[] }

function LinkListSection({ title, description, items, itemType }: { title: string; description: string; items: LinkListItem[]; itemType: 'learning_path' | 'resource' }) {
  return <section className="brief-section">
    <div className="section-heading"><div><h2>{title}</h2><p>{description}</p></div></div>
    <ul className="brief-links">
      {items.map(({ id, title: itemTitle, url, Icon, kindLabel, detail, meta, sourceIds }) => {
        const href = safeUrl(url)
        return <li key={id}>
          <span className="brief-link-icon" title={kindLabel}><Icon size={16} aria-hidden="true" /></span>
          <div>
            {href ? <a className="brief-item-title" href={href} target="_blank" rel="noopener noreferrer">{itemTitle} <ExternalLink size={11} aria-hidden="true" /></a> : <span className="brief-item-title">{itemTitle}</span>}
            {detail && <span className="brief-item-detail">{detail}</span>}
            <ItemMeta itemType={itemType} itemId={id} title={itemTitle} sourceIds={sourceIds}>
              <span>{kindLabel}{meta ? ` · ${meta}` : ''}</span>
              <Recommended itemType={itemType} itemId={id} />
            </ItemMeta>
          </div>
        </li>
      })}
    </ul>
  </section>
}

function SourcesList({ brief }: { brief: StudyBriefDto }) {
  const { sources } = brief.content
  if (!sources.length) return null
  return <details className="brief-section brief-sources">
    <summary><h2>All sources</h2> <span className="muted-inline">{sources.length} cited</span></summary>
    <ol>
      {sources.map((source) => {
        const href = safeUrl(source.url)
        return <li key={source.id}>
          {href ? <a href={href} target="_blank" rel="noopener noreferrer">{source.title} <ExternalLink size={11} aria-hidden="true" /></a> : <span>{source.title}</span>}
          <span className="brief-link-kind">{[source.publisher, source.kind, `retrieved ${formatDate(source.retrievedAt)}`].filter(Boolean).join(' · ')}</span>
          {source.snippet && <q>{source.snippet}</q>}
        </li>
      })}
    </ol>
  </details>
}
