import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Tabs } from '../../components/ui/Tabs'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { useTabParam } from '../../hooks/useTabParam'
import { CertificationSearch } from './CertificationSearch'
import { ContinueCard, MyCertifications } from './MyCertifications'
import { ProviderBrowse } from './ProviderBrowse'
import { useMyCertifications } from './useMyCertifications'
import './home.css'

const tabIds = ['search', 'mine', 'providers'] as const

function HowItWorks() {
  return <>
    <ol className="home-steps">
      <li><strong>Search.</strong> Find your exam by code or name, or describe your goals and get a recommendation.</li>
      <li><strong>The agent researches.</strong> It reads the official exam page, learning path and community discussion, and cites every source.</li>
      <li><strong>Follow a cited checklist.</strong> Work through the study checklist, track progress, and flag anything inaccurate or outdated.</li>
    </ol>
    <p className="home-library-note">Looking for notes and question sets shared by colleagues? <Link to="/library">Community library</Link></p>
  </>
}

export function HomePage() {
  useDocumentTitle('Find a certification')
  const location = useLocation()
  const navigate = useNavigate()
  const mobile = useIsMobile()
  const mine = useMyCertifications()
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

  // "My certifications" links: /#mine scrolls on desktop; /?tab=mine opens the tab on mobile. Each width accepts the other form.
  useEffect(() => {
    if (mobile && location.hash === '#mine') navigate('/?tab=mine', { replace: true })
    else if (!mobile && (location.hash === '#mine' || activeTab === 'mine')) document.getElementById('mine')?.scrollIntoView()
  }, [activeTab, location.hash, mobile, navigate])

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
        <ContinueCard state={mine} />
        <details className="disclosure home-next">
          <summary>What happens next</summary>
          <HowItWorks />
        </details>
      </section> },
      { id: 'mine', label: 'Mine', content: <MyCertifications state={mine} /> },
      { id: 'providers', label: 'Providers', content: <ProviderBrowse onPick={pickProvider} /> },
    ]} />
  </div>

  return <div className="page-content home-page">
    <section className="home-hero" ref={heroRef} aria-labelledby="home-question">
      <h1 id="home-question">Which certification are you preparing for?</h1>
      <p className="page-desc">Search by exam code, name or provider. We research the official exam page, learning path and community advice into a cited study checklist.</p>
      {search}
      {chooseLink}
    </section>

    <MyCertifications state={mine} />

    <ProviderBrowse onPick={pickProvider} />

    <section className="section" aria-labelledby="how-heading">
      <div className="section-heading"><h2 id="how-heading">How it works</h2></div>
      <HowItWorks />
    </section>
  </div>
}
