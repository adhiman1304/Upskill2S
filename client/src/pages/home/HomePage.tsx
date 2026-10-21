import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { CertificationSearch } from './CertificationSearch'
import { MyCertifications } from './MyCertifications'
import { ProviderBrowse } from './ProviderBrowse'
import './home.css'

export function HomePage() {
  useDocumentTitle('Find a certification')
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
      <h1 id="home-question">Which certification are you preparing for?</h1>
      <p className="page-desc">Search by exam code, name or provider. We research the official exam page, learning path and community advice into a cited study checklist.</p>
      <CertificationSearch query={query} onQueryChange={setQuery} inputRef={inputRef} />
      <Link className="home-choose-link" to="/intake">Not sure yet? Help me choose <ArrowRight size={15} aria-hidden="true" /></Link>
    </section>

    <MyCertifications />

    <ProviderBrowse onPick={pickProvider} />

    <section className="section" aria-labelledby="how-heading">
      <div className="section-heading"><h2 id="how-heading">How it works</h2></div>
      <ol className="home-steps">
        <li><strong>Search.</strong> Find your exam by code or name, or describe your goals and get a recommendation.</li>
        <li><strong>The agent researches.</strong> It reads the official exam page, learning path and community discussion, and cites every source.</li>
        <li><strong>Follow a cited checklist.</strong> Work through the study checklist, track progress, and flag anything inaccurate or outdated.</li>
      </ol>
      <p className="home-library-note">Looking for notes and question sets shared by colleagues? <Link to="/library">Community library</Link></p>
    </section>
  </div>
}
