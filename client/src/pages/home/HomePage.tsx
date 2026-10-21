import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, BookOpenCheck, Compass, ListChecks, Search, Sparkles } from 'lucide-react'
import { CertificationSearch } from './CertificationSearch'
import { MyCertifications } from './MyCertifications'
import { ProviderBrowse } from './ProviderBrowse'
import './home.css'

export function HomePage() {
  const location = useLocation()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const heroRef = useRef<HTMLElement | null>(null)

  // The sidebar's "My certifications" link points at /#mine.
  useEffect(() => { if (location.hash === '#mine') document.getElementById('mine')?.scrollIntoView() }, [location.hash])

  function pickProvider(provider: string) {
    setQuery(provider)
    heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    inputRef.current?.focus({ preventScroll: true })
  }

  return <div className="page-content home-page">
    <section className="home-hero" ref={heroRef} aria-labelledby="home-question">
      <p className="eyebrow">STUDY</p>
      <h1 id="home-question">Which certification are you preparing for?</h1>
      <p className="home-lede">Search by exam code, name or provider. We research the official exam page, learning path and community advice into a cited study checklist.</p>
      <CertificationSearch query={query} onQueryChange={setQuery} inputRef={inputRef} />
      <Link className="home-choose-link" to="/intake"><Compass size={16} aria-hidden="true" /> I don't know yet, help me choose <ArrowRight size={15} aria-hidden="true" /></Link>
    </section>

    <MyCertifications />

    <ProviderBrowse onPick={pickProvider} />

    <section className="home-section" aria-labelledby="how-heading">
      <div className="section-heading"><div><h2 id="how-heading">How it works</h2></div></div>
      <ol className="home-steps">
        <li><span className="home-step-icon"><Search size={18} aria-hidden="true" /></span><strong>Search</strong><p>Find your exam by code or name, or describe your goals and get a recommendation.</p></li>
        <li><span className="home-step-icon"><Sparkles size={18} aria-hidden="true" /></span><strong>The agent researches</strong><p>It reads the official exam page, learning path and community discussion, and cites every source.</p></li>
        <li><span className="home-step-icon"><ListChecks size={18} aria-hidden="true" /></span><strong>Follow a cited checklist</strong><p>Work through the study checklist, track progress, and flag anything inaccurate or outdated.</p></li>
      </ol>
      <p className="home-library-note"><BookOpenCheck size={15} aria-hidden="true" /> Looking for notes and question sets shared by colleagues? <Link to="/library">Community library</Link></p>
    </section>
  </div>
}
