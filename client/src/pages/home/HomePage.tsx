import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Tabs } from '../../components/ui/Tabs'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { useTabParam } from '../../hooks/useTabParam'
import { CertificationSearch } from './CertificationSearch'
import { ContinueCard } from './ContinueCard'
import { ProviderBrowse } from './ProviderBrowse'
import { useContinueCertification } from './useContinueCertification'
import './home.css'

const tabIds = ['search', 'providers'] as const

function HowItWorks() {
  return <>
    <ol className="home-steps">
      <li><strong>Search.</strong> Find your exam by code or name, or describe your goals and get a recommendation.</li>
      <li><strong>The agent researches.</strong> It reads the official exam page, learning path and community discussion, and cites every source.</li>
      <li><strong>Follow a cited checklist.</strong> Work through the study checklist, track progress, star what helped and report anything wrong.</li>
    </ol>
    <p className="home-library-note">Looking for notes and question sets shared by colleagues? <Link to="/library">Community library</Link></p>
  </>
}

export function HomePage() {
  useDocumentTitle('Find a certification')
  const location = useLocation()
  const navigate = useNavigate()
  const mobile = useIsMobile()
  const continueState = useContinueCertification()
  const [query, setQuery] = useState('')
  const [activeTab, selectTab] = useTabParam(tabIds)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const heroRef = useRef<HTMLElement | null>(null)
  const focusSearch = useRef(false)

  // After picking a provider on the mobile Providers tab, focus the search once the Search tab has rendered.
  useEffect(() => {
    if (activeTab !== 'search' || !focusSearch.current) return
    focusSearch.current = false
    inputRef.current?.focus({ preventScroll: true })
  }, [activeTab])

  // Old "My certifications" links (/#mine, /?tab=mine) now go to their own page.
  useEffect(() => {
    if (location.hash === '#mine' || new URLSearchParams(location.search).get('tab') === 'mine') navigate('/my-certifications', { replace: true })
  }, [location.hash, location.search, navigate])

  function pickProvider(provider: string) {
    setQuery(provider)
    if (mobile) {
      focusSearch.current = true
      selectTab('search')
      window.scrollTo({ top: 0 })
      return
    }
    heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    inputRef.current?.focus({ preventScroll: true })
  }

  const search = <CertificationSearch query={query} onQueryChange={setQuery} inputRef={inputRef} />
  const chooseLink = <Link className="home-choose-link" to="/intake">Not sure yet? Help me choose <ArrowRight size={15} aria-hidden="true" /></Link>

  if (mobile) return <div className="page-content home-page">
    <h1 id="home-question" className="home-question">Which certification are you preparing for?</h1>
    <Tabs mode="tabs" label="Find a certification" tabs={[
      { id: 'search', label: 'Search', content: <section className="home-hero" ref={heroRef} aria-labelledby="home-question">
        {search}
        {chooseLink}
        <ContinueCard state={continueState} />
        <details className="disclosure home-next">
          <summary>What happens next</summary>
          <HowItWorks />
        </details>
      </section> },
      { id: 'providers', label: 'Providers', content: <ProviderBrowse onPick={pickProvider} /> },
    ]} />
  </div>

  return <div className="page-content home-page">
    <section className="home-hero" ref={heroRef} aria-labelledby="home-question">
      <h1 id="home-question">Which certification are you preparing for?</h1>
      <p className="page-desc">Search by exam code, name or provider. We research the official exam page, learning path and community advice into a cited study checklist.</p>
      {search}
      {chooseLink}
      <ContinueCard state={continueState} />
    </section>

    <ProviderBrowse onPick={pickProvider} />

    <section className="section" aria-labelledby="how-heading">
      <div className="section-heading"><h2 id="how-heading">How it works</h2></div>
      <HowItWorks />
    </section>
  </div>
}
