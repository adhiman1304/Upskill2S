// SAMPLE DATA for local development only. Loaded by BriefPage when `import.meta.env.DEV` is true and the URL has
// `?fixture=1`, so the brief UI can be built and demoed before the research pipeline (workstream A) exists.
// It is hand-written to match the StudyBriefContent contract; facts are illustrative and must not be treated as
// a researched brief. The UI labels it "Sample data".
import type { StudyBriefContent } from '../../../lib/contracts'

const retrievedAt = '2026-10-18T09:30:00.000Z'

export const dp700SampleBrief: StudyBriefContent = {
  certification: {
    provider: 'Microsoft',
    code: 'DP-700',
    title: 'Implementing Data Engineering Solutions Using Microsoft Fabric',
    officialUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/fabric-data-engineer-associate/',
    examVersion: 'English skills outline',
    lastOfficialUpdate: '2026-07-21',
    retirementNotice: null,
  },
  summary: 'DP-700 validates that you can design, build and operate data engineering solutions in Microsoft Fabric: lakehouses, warehouses, eventhouses, pipelines, dataflows, notebooks and real-time intelligence. The three skill areas carry roughly equal weight, so plan to be hands-on with ingestion, transformation, security and monitoring rather than specialising in one engine. Community reports consistently say the exam rewards practical experience with Spark notebooks, KQL and T-SQL inside Fabric more than memorised feature lists.',
  examFormat: {
    durationMinutes: 100,
    questionCount: 'About 40 to 60 questions, including a case study',
    passingScore: '700 out of 1000',
    cost: 'USD 165 (varies by country)',
    languages: ['English', 'Japanese', 'Chinese (Simplified)', 'German', 'French', 'Spanish', 'Portuguese (Brazil)'],
    deliveryOptions: ['Online proctored (Pearson VUE)', 'Pearson VUE test center'],
    notes: 'Microsoft Learn is available during the exam as an open-book reference, but searching it costs time; know where things live.',
  },
  skillsMeasured: [
    {
      id: 'implement-and-manage-an-analytics-solution',
      title: 'Implement and manage an analytics solution',
      weightPercent: 32,
      subtopics: ['Configure Microsoft Fabric workspace settings', 'Implement lifecycle management (Git integration, deployment pipelines)', 'Configure security and governance (workspace roles, item permissions, row and column level security, sensitivity labels)', 'Orchestrate processes with pipelines and notebooks'],
      sourceIds: ['ms-study-guide'],
    },
    {
      id: 'ingest-and-transform-data',
      title: 'Ingest and transform data',
      weightPercent: 34,
      subtopics: ['Design and implement loading patterns (full, incremental, streaming)', 'Ingest and transform batch data with pipelines, Dataflow Gen2, notebooks and T-SQL', 'Ingest and transform streaming data with eventstreams, Spark structured streaming and KQL', 'Choose between shortcuts, mirroring and copy'],
      sourceIds: ['ms-study-guide', 'reddit-fabric-exam'],
    },
    {
      id: 'monitor-and-optimize-an-analytics-solution',
      title: 'Monitor and optimize an analytics solution',
      weightPercent: 34,
      subtopics: ['Monitor Fabric items with the Monitoring hub and capacity metrics', 'Identify and resolve errors in pipelines, dataflows, notebooks and eventstreams', 'Optimize lakehouse tables (V-Order, OPTIMIZE, VACUUM, partitioning)', 'Optimize Spark, warehouse and eventhouse performance'],
      sourceIds: ['ms-study-guide', 'fabric-docs-delta-optimization'],
    },
  ],
  officialLearningPath: [
    { id: 'fabric-data-engineer-course', title: 'Course DP-700T00: Microsoft Fabric Data Engineer', url: 'https://learn.microsoft.com/en-us/training/courses/dp-700t00', type: 'learning_path', estimatedMinutes: 720, notes: 'Self-paced modules that mirror the instructor-led course.', sourceIds: ['ms-cert-page'] },
    { id: 'dp-700-study-guide', title: 'DP-700 study guide (skills measured)', url: 'https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700', type: 'docs', estimatedMinutes: 30, notes: 'Read first and again in the last week; it lists every skill and recent changes.', sourceIds: ['ms-study-guide'] },
    { id: 'dp-700-practice-assessment', title: 'Free official practice assessment', url: 'https://learn.microsoft.com/en-us/credentials/certifications/fabric-data-engineer-associate/practice/assessment?assessment-type=practice&assessmentId=90', type: 'practice_assessment', estimatedMinutes: 60, notes: 'Retake until you score consistently above 80 percent.', sourceIds: ['ms-cert-page'] },
    { id: 'fabric-end-to-end-tutorials', title: 'Fabric end-to-end tutorials', url: 'https://learn.microsoft.com/en-us/fabric/fundamentals/end-to-end-tutorials', type: 'docs', estimatedMinutes: 240, notes: 'Lakehouse, data warehouse and real-time intelligence scenarios.', sourceIds: ['fabric-docs-tutorials'] },
    { id: 'exam-sandbox', title: 'Exam sandbox (try the exam interface)', url: 'https://aka.ms/examdemo', type: 'exam_sandbox', estimatedMinutes: 20, notes: null, sourceIds: ['ms-cert-page'] },
  ],
  communityResources: [
    { id: 'reddit-microsoftfabric', title: 'r/MicrosoftFabric exam experience threads', url: 'https://www.reddit.com/r/MicrosoftFabric/', kind: 'forum', author: null, publishedAt: null, whyRecommended: 'Recent pass and fail reports with notes on which topics showed up most (KQL, incremental loads, security).', sourceIds: ['reddit-fabric-exam'] },
    { id: 'fabric-community-forum', title: 'Microsoft Fabric Community forums', url: 'https://community.fabric.microsoft.com/', kind: 'forum', author: 'Microsoft Fabric Community', publishedAt: null, whyRecommended: 'Good for checking current behaviour of features that changed after the course content was written.', sourceIds: ['fabric-community'] },
    { id: 'guy-in-a-cube-fabric', title: 'Guy in a Cube: Microsoft Fabric videos', url: 'https://www.youtube.com/@GuyInACube', kind: 'video', author: 'Guy in a Cube', publishedAt: null, whyRecommended: 'Short practical walkthroughs of lakehouse, warehouse and capacity topics.', sourceIds: ['youtube-guy-in-a-cube'] },
    { id: 'microsoft-fabric-samples', title: 'microsoft/fabric-samples on GitHub', url: 'https://github.com/microsoft/fabric-samples', kind: 'github', author: 'Microsoft', publishedAt: null, whyRecommended: 'Notebooks and sample data you can load into a trial capacity to practise the transformations.', sourceIds: ['github-fabric-samples'] },
  ],
  knownGaps: [
    { id: 'kql-and-real-time-intelligence', title: 'KQL and Real-Time Intelligence get more weight than the course suggests', detail: 'Several candidates report multiple questions on eventstreams, eventhouses and writing or reading KQL, while the self-paced modules cover them briefly.', recommendation: 'Do the Real-Time Intelligence tutorial end to end and practise basic KQL (where, summarize, bin, join, materialized views).', confidence: 'high', sourceIds: ['reddit-fabric-exam', 'fabric-docs-tutorials'] },
    { id: 'deployment-pipelines-and-git', title: 'Lifecycle management details', detail: 'Questions on Git integration and deployment pipelines test which items are supported and how rules and branching work, which is easy to skip in a sandbox.', recommendation: 'Connect a trial workspace to a Git repo and promote items through a three-stage deployment pipeline at least once.', confidence: 'medium', sourceIds: ['ms-study-guide', 'reddit-fabric-exam'] },
    { id: 'delta-table-maintenance', title: 'Delta table maintenance and V-Order', detail: 'Optimization questions expect you to know when to run OPTIMIZE, VACUUM and how V-Order affects read and write performance.', recommendation: 'Read the Delta Lake table optimization page and run the maintenance commands on a sample lakehouse.', confidence: 'medium', sourceIds: ['fabric-docs-delta-optimization'] },
    { id: 'preview-features', title: 'Features in preview may still appear', detail: 'Fabric changes monthly. Some community notes mention questions on features that were in preview when the outline was last updated.', recommendation: 'Check the study guide change log the week before your exam and skim the Fabric monthly update blog.', confidence: 'low', sourceIds: ['reddit-fabric-exam'] },
  ],
  checklist: [
    { id: 'read-the-study-guide', order: 1, phase: 'orient', title: 'Read the DP-700 study guide', detail: 'Note every skill you have never done hands-on; that list drives the rest of the plan.', estimatedMinutes: 30, links: [{ label: 'Study guide', url: 'https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700' }], sourceIds: ['ms-study-guide'] },
    { id: 'take-baseline-practice-assessment', order: 2, phase: 'orient', title: 'Take the practice assessment cold', detail: 'Get a baseline score per skill area before studying.', estimatedMinutes: 60, links: [{ label: 'Practice assessment', url: 'https://learn.microsoft.com/en-us/credentials/certifications/fabric-data-engineer-associate/practice/assessment?assessment-type=practice&assessmentId=90' }], sourceIds: ['ms-cert-page'] },
    { id: 'start-fabric-trial', order: 3, phase: 'orient', title: 'Start a Fabric trial capacity', detail: 'You need a workspace on a Fabric capacity to practise every item type.', estimatedMinutes: 15, links: [{ label: 'Fabric trial', url: 'https://learn.microsoft.com/en-us/fabric/fundamentals/fabric-trial' }], sourceIds: ['fabric-docs-tutorials'] },
    { id: 'complete-lakehouse-tutorial', order: 4, phase: 'learn', title: 'Complete the lakehouse end-to-end tutorial', detail: 'Covers ingestion with pipelines, notebooks and Delta tables.', estimatedMinutes: 120, links: [{ label: 'Tutorials', url: 'https://learn.microsoft.com/en-us/fabric/fundamentals/end-to-end-tutorials' }], sourceIds: ['fabric-docs-tutorials'] },
    { id: 'complete-warehouse-tutorial', order: 5, phase: 'learn', title: 'Complete the data warehouse tutorial', detail: 'Focus on T-SQL loading patterns and cross-database queries.', estimatedMinutes: 90, links: [], sourceIds: ['fabric-docs-tutorials'] },
    { id: 'complete-real-time-intelligence-tutorial', order: 6, phase: 'learn', title: 'Complete the Real-Time Intelligence tutorial', detail: 'Eventstreams, eventhouse and KQL queryset; the most commonly reported gap.', estimatedMinutes: 120, links: [], sourceIds: ['fabric-docs-tutorials', 'reddit-fabric-exam'] },
    { id: 'work-through-course-modules', order: 7, phase: 'learn', title: 'Work through the DP-700T00 modules', detail: 'Skip modules you scored well on in the baseline.', estimatedMinutes: 600, links: [{ label: 'Course', url: 'https://learn.microsoft.com/en-us/training/courses/dp-700t00' }], sourceIds: ['ms-cert-page'] },
    { id: 'configure-security-end-to-end', order: 8, phase: 'learn', title: 'Configure workspace and item security', detail: 'Workspace roles, item sharing, row level and column level security, and sensitivity labels.', estimatedMinutes: 60, links: [], sourceIds: ['ms-study-guide'] },
    { id: 'build-incremental-load', order: 9, phase: 'practice', title: 'Build an incremental load with a watermark', detail: 'Implement it once with a pipeline and once with a notebook.', estimatedMinutes: 90, links: [], sourceIds: ['ms-study-guide'] },
    { id: 'practice-git-and-deployment-pipelines', order: 10, phase: 'practice', title: 'Practise Git integration and deployment pipelines', detail: 'Promote a lakehouse, notebook and pipeline through dev, test and prod.', estimatedMinutes: 60, links: [], sourceIds: ['reddit-fabric-exam'] },
    { id: 'practice-kql-queries', order: 11, phase: 'practice', title: 'Write 20 KQL queries against sample data', detail: 'where, summarize, bin, join, render and materialized views.', estimatedMinutes: 90, links: [], sourceIds: ['reddit-fabric-exam'] },
    { id: 'run-table-maintenance', order: 12, phase: 'practice', title: 'Run Delta table maintenance', detail: 'OPTIMIZE with V-Order, VACUUM, and compare read performance before and after.', estimatedMinutes: 45, links: [{ label: 'Delta optimization', url: 'https://learn.microsoft.com/en-us/fabric/data-engineering/delta-optimization-and-v-order' }], sourceIds: ['fabric-docs-delta-optimization'] },
    { id: 'retake-practice-assessment', order: 13, phase: 'review', title: 'Retake the practice assessment', detail: 'Aim for 80 percent or more on two consecutive attempts.', estimatedMinutes: 60, links: [], sourceIds: ['ms-cert-page'] },
    { id: 'review-weak-skill-areas', order: 14, phase: 'review', title: 'Review your weakest skill area', detail: 'Re-read the matching study guide section and redo one hands-on lab.', estimatedMinutes: 120, links: [], sourceIds: ['ms-study-guide'] },
    { id: 'check-study-guide-changes', order: 15, phase: 'review', title: 'Check the study guide change log', detail: 'Do this in the final week; Fabric content changes often.', estimatedMinutes: 15, links: [], sourceIds: ['ms-study-guide'] },
    { id: 'try-exam-sandbox', order: 16, phase: 'exam_day', title: 'Try the exam sandbox', detail: 'Learn the case study and Microsoft Learn navigation before exam day.', estimatedMinutes: 20, links: [{ label: 'Exam sandbox', url: 'https://aka.ms/examdemo' }], sourceIds: ['ms-cert-page'] },
    { id: 'run-system-test', order: 17, phase: 'exam_day', title: 'Run the Pearson VUE system test (online exams)', detail: 'Check camera, network and workspace rules a day ahead.', estimatedMinutes: 15, links: [], sourceIds: ['ms-cert-page'] },
  ],
  warnings: [
    'Sample data: this brief is a hand-written development fixture, not a researched result.',
    'Fabric releases monthly; confirm skill weights on the official study guide before booking.',
  ],
  sources: [
    { id: 'ms-cert-page', url: 'https://learn.microsoft.com/en-us/credentials/certifications/fabric-data-engineer-associate/', title: 'Microsoft Certified: Fabric Data Engineer Associate', publisher: 'Microsoft Learn', kind: 'official', retrievedAt, snippet: 'Exam DP-700 measures your ability to ingest, transform, secure and manage data in Microsoft Fabric.' },
    { id: 'ms-study-guide', url: 'https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700', title: 'Study guide for Exam DP-700', publisher: 'Microsoft Learn', kind: 'official', retrievedAt, snippet: 'Skills measured and the change log for the exam.' },
    { id: 'fabric-docs-tutorials', url: 'https://learn.microsoft.com/en-us/fabric/fundamentals/end-to-end-tutorials', title: 'End-to-end tutorials in Microsoft Fabric', publisher: 'Microsoft Learn', kind: 'official', retrievedAt, snippet: null },
    { id: 'fabric-docs-delta-optimization', url: 'https://learn.microsoft.com/en-us/fabric/data-engineering/delta-optimization-and-v-order', title: 'Delta Lake table optimization and V-Order', publisher: 'Microsoft Learn', kind: 'official', retrievedAt, snippet: null },
    { id: 'reddit-fabric-exam', url: 'https://www.reddit.com/r/MicrosoftFabric/', title: 'r/MicrosoftFabric: DP-700 exam experiences', publisher: 'Reddit', kind: 'forum', retrievedAt, snippet: 'Candidates mention KQL, eventstreams and deployment pipelines as surprise topics.' },
    { id: 'fabric-community', url: 'https://community.fabric.microsoft.com/', title: 'Microsoft Fabric Community', publisher: 'Microsoft', kind: 'community', retrievedAt, snippet: null },
    { id: 'youtube-guy-in-a-cube', url: 'https://www.youtube.com/@GuyInACube', title: 'Guy in a Cube', publisher: 'YouTube', kind: 'video', retrievedAt, snippet: null },
    { id: 'github-fabric-samples', url: 'https://github.com/microsoft/fabric-samples', title: 'microsoft/fabric-samples', publisher: 'GitHub', kind: 'community', retrievedAt, snippet: null },
  ],
}
