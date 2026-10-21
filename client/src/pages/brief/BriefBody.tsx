import { AlertTriangle, BookOpen, ClipboardCheck, ExternalLink, FileText, FolderGit2, GraduationCap, Headphones, Link2, ListChecks, MessagesSquare, MonitorPlay, Newspaper, Presentation, Route, Video } from 'lucide-react'
import type { CommunityResource, KnownGap, LearningPathItem, StudyBriefDto } from '../../lib/contracts'
import { formatDate } from '../legacy/utils'
import { formatMinutes, safeUrl } from './brief-utils'
import { ChecklistSection } from './ChecklistSection'
import { FeedbackControl, SourceChips } from './FeedbackControl'

const resourceIcons: Record<CommunityResource['kind'], typeof Video> = { video: Video, course: GraduationCap, blog: Newspaper, practice_questions: ListChecks, github: FolderGit2, podcast: Headphones, forum: MessagesSquare, other: Link2 }
const resourceLabels: Record<CommunityResource['kind'], string> = { video: 'Video', course: 'Course', blog: 'Blog', practice_questions: 'Practice questions', github: 'GitHub', podcast: 'Podcast', forum: 'Forum', other: 'Link' }
const pathIcons: Record<LearningPathItem['type'], typeof Video> = { learning_path: Route, module: BookOpen, docs: FileText, practice_assessment: ClipboardCheck, instructor_led: Presentation, exam_sandbox: MonitorPlay, other: Link2 }
const pathLabels: Record<LearningPathItem['type'], string> = { learning_path: 'Learning path', module: 'Module', docs: 'Docs', practice_assessment: 'Practice assessment', instructor_led: 'Instructor-led', exam_sandbox: 'Exam sandbox', other: 'Link' }
const confidenceLabels: Record<KnownGap['confidence'], string> = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' }

interface BriefBodyProps { brief: StudyBriefDto; completedItemIds: string[]; onToggle: (itemId: string, completed: boolean) => void }

export function BriefBody({ brief, completedItemIds, onToggle }: BriefBodyProps) {
  const { content } = brief
  return <div className="brief-body">
    <SummarySection brief={brief} />
    <ExamFacts brief={brief} />
    <div className="brief-layout">
      <div className="brief-main">
        <ChecklistSection items={content.checklist} completedItemIds={completedItemIds} onToggle={onToggle} />
        {content.knownGaps.length > 0 && <GapsSection gaps={content.knownGaps} />}
      </div>
      <aside className="brief-aside">
        {content.skillsMeasured.length > 0 && <SkillsSection brief={brief} />}
        {content.officialLearningPath.length > 0 && <LinkListSection title="Official learning path" description="From the exam provider." items={content.officialLearningPath.map((item) => ({ id: item.id, title: item.title, url: item.url, Icon: pathIcons[item.type], kindLabel: pathLabels[item.type], detail: item.notes, meta: formatMinutes(item.estimatedMinutes), sourceIds: item.sourceIds }))} itemType="learning_path" />}
        {content.communityResources.length > 0 && <LinkListSection title="Community resources" description="Recommended by the community; not official." items={content.communityResources.map((item) => ({ id: item.id, title: item.title, url: item.url, Icon: resourceIcons[item.kind], kindLabel: resourceLabels[item.kind], detail: item.whyRecommended, meta: [item.author, item.publishedAt ? formatDate(item.publishedAt) : null].filter(Boolean).join(' · '), sourceIds: item.sourceIds }))} itemType="resource" />}
        <SourcesPanel brief={brief} />
      </aside>
    </div>
  </div>
}

function SummarySection({ brief }: { brief: StudyBriefDto }) {
  const { content } = brief
  const notices = [content.certification.retirementNotice, ...content.warnings].filter((value): value is string => Boolean(value))
  return <section className="brief-section brief-summary">
    <div className="brief-summary-head"><h2>Summary</h2><FeedbackControl itemType="brief" itemId="brief" /></div>
    <p className="brief-summary-text">{content.summary}</p>
    {notices.length > 0 && <ul className="brief-warnings">{notices.map((warning, index) => <li key={index} className="alert warning"><AlertTriangle size={14} aria-hidden="true" /> {warning}</li>)}</ul>}
  </section>
}

function ExamFacts({ brief }: { brief: StudyBriefDto }) {
  const { examFormat, certification } = brief.content
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
  if (!facts.length && !examFormat.notes) return null
  return <section className="brief-facts" aria-label="Exam format">
    <dl>{facts.map((fact) => <div key={fact.label} title={fact.title}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
    {examFormat.notes && <p className="brief-facts-note">{examFormat.notes}</p>}
  </section>
}

function SkillsSection({ brief }: { brief: StudyBriefDto }) {
  return <section className="brief-section">
    <div className="section-heading"><div><h2>Skills measured</h2><p>Weights from the official skills outline.</p></div></div>
    <ul className="brief-skills">
      {brief.content.skillsMeasured.map((skill) => <li key={skill.id}>
        <div className="brief-skill-head"><span className="brief-item-title">{skill.title}</span>{skill.weightPercent !== null && <strong>{skill.weightPercent}%</strong>}</div>
        {skill.weightPercent !== null && <span className="brief-weight-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, skill.weightPercent))}%` }} /></span>}
        {skill.subtopics.length > 0 && <ul className="brief-subtopics">{skill.subtopics.map((topic, index) => <li key={index}>{topic}</li>)}</ul>}
        <div className="brief-item-meta"><SourceChips ids={skill.sourceIds} /><FeedbackControl itemType="skill" itemId={skill.id} /></div>
      </li>)}
    </ul>
  </section>
}

function GapsSection({ gaps }: { gaps: KnownGap[] }) {
  return <section className="brief-section">
    <div className="section-heading"><div><h2>Known gaps</h2><p>Where candidates say the official material falls short.</p></div></div>
    <div className="brief-gaps">
      {gaps.map((gap) => <article key={gap.id} className="brief-gap">
        <div className="brief-gap-top"><span className={`chip brief-confidence-${gap.confidence}`}>{confidenceLabels[gap.confidence]}</span><SourceChips ids={gap.sourceIds} /></div>
        <h3>{gap.title}</h3>
        <p>{gap.detail}</p>
        <p className="brief-gap-recommendation"><strong>Do this:</strong> {gap.recommendation}</p>
        <div className="brief-item-meta"><FeedbackControl itemType="gap" itemId={gap.id} /></div>
      </article>)}
    </div>
  </section>
}

interface LinkListItem { id: string; title: string; url: string; Icon: typeof Video; kindLabel: string; detail: string | null; meta: string; sourceIds: string[] }

function LinkListSection({ title, description, items, itemType }: { title: string; description: string; items: LinkListItem[]; itemType: 'learning_path' | 'resource' }) {
  return <section className="brief-section">
    <div className="section-heading"><div><h2>{title}</h2><p>{description}</p></div></div>
    <ul className="brief-links">
      {items.map(({ id, title: itemTitle, url, Icon, kindLabel, detail, meta, sourceIds }) => {
        const href = safeUrl(url)
        return <li key={id}>
          <span className="brief-link-icon" title={kindLabel}><Icon size={15} aria-hidden="true" /></span>
          <div>
            {href ? <a className="brief-item-title" href={href} target="_blank" rel="noopener noreferrer">{itemTitle} <ExternalLink size={10} /></a> : <span className="brief-item-title">{itemTitle}</span>}
            <span className="brief-link-kind">{kindLabel}{meta ? ` · ${meta}` : ''}</span>
            {detail && <span className="brief-item-detail">{detail}</span>}
            <div className="brief-item-meta"><SourceChips ids={sourceIds} /><FeedbackControl itemType={itemType} itemId={id} /></div>
          </div>
        </li>
      })}
    </ul>
  </section>
}

function SourcesPanel({ brief }: { brief: StudyBriefDto }) {
  const { sources } = brief.content
  return <details className="brief-section brief-sources">
    <summary><h2>Sources</h2> <span className="muted-inline">{sources.length} cited · generated {formatDate(brief.generatedAt)} with {brief.model}</span></summary>
    <ol>
      {sources.map((source) => {
        const href = safeUrl(source.url)
        return <li key={source.id}>
          <div>
            {href ? <a href={href} target="_blank" rel="noopener noreferrer">{source.title} <ExternalLink size={10} /></a> : <span>{source.title}</span>}
            <span className="brief-link-kind">{[source.publisher, source.kind, `retrieved ${formatDate(source.retrievedAt)}`].filter(Boolean).join(' · ')}</span>
            {source.snippet && <q>{source.snippet}</q>}
          </div>
        </li>
      })}
    </ol>
  </details>
}
