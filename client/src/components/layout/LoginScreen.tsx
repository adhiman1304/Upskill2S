import { ArrowUpRight, ShieldCheck } from 'lucide-react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { Brand } from './Brand'

export function LoginScreen({ onSignIn, error }: { onSignIn: () => void; error: string }) {
  useDocumentTitle('Sign in')
  return <main className="login-screen"><section className="login-copy"><Brand /><div className="login-message"><p className="eyebrow">Your certification library</p><h1>Make learning move forward.</h1><p>One shared place for certification paths, questions, notes, and trusted resources.</p></div><p className="login-bottom">A company learning resource</p></section><section className="login-form-panel"><div className="login-form-wrap"><h2>Sign in to continue</h2><p className="muted">Use your company Microsoft account to open the certification library.</p>{error && <div className="alert error" role="alert">{error}</div>}<button className="button button-primary sign-in-button" onClick={onSignIn}>Sign in with Microsoft <ArrowUpRight size={16} /></button><p className="sign-in-note"><ShieldCheck size={14} /> Company account required</p></div><span className="login-version">Upskill · internal learning</span></section></main>
}
