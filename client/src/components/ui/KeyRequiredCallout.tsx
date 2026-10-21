import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound } from 'lucide-react'

/** Warning shown when an AI action returns 412 OPENAI_KEY_MISSING: explains why and links to Settings. */
export function KeyRequiredCallout({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`alert warning key-callout${className ? ` ${className}` : ''}`} role="alert">
    <KeyRound size={16} aria-hidden="true" />
    <div><strong>Add your OpenAI API key first.</strong><p>{children}</p></div>
    <Link className="button button-secondary button-small" to="/settings">Open settings</Link>
  </div>
}
