import { ShieldCheck } from 'lucide-react'
import { Brand } from './Brand'

export function SetupScreen() {
  return <main className="setup-screen"><section className="setup-panel"><Brand /><div className="setup-icon"><ShieldCheck size={24} /></div><p className="eyebrow">WORKSPACE SETUP</p><h1>Connect your company account</h1><p className="setup-copy">Configure Microsoft Entra ID to enable company sign-in. Add the tenant, app, and API scope values to <code>client/.env</code>.</p><div className="setup-code"><code>VITE_ENTRA_TENANT_ID</code><code>VITE_ENTRA_CLIENT_ID</code><code>VITE_ENTRA_API_SCOPE</code></div><p className="setup-footnote">See README.md for local app registration and API setup.</p></section></main>
}
