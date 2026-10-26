import { ShieldCheck } from 'lucide-react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { Brand } from './Brand'

export function SetupScreen() {
  useDocumentTitle('Setup')
  return <main className="setup-screen"><section className="setup-panel"><Brand /><ShieldCheck className="setup-icon" size={22} aria-hidden="true" /><h1>Connect your company account</h1><p className="setup-copy">Configure Microsoft Entra ID to enable company sign-in. Add the tenant, app, and API scope values to <code>client/.env</code>.</p><div className="setup-code"><code>VITE_ENTRA_TENANT_ID</code><code>VITE_ENTRA_CLIENT_ID</code><code>VITE_ENTRA_API_SCOPE</code></div><p className="setup-footnote">See README.md for local app registration and API setup.</p></section></main>
}
