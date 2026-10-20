import { PublicClientApplication } from '@azure/msal-browser'

const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID?.trim()
const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID?.trim()
const apiScope = import.meta.env.VITE_ENTRA_API_SCOPE?.trim()

export const devAuthBypass = import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'
export const msalSetupComplete = Boolean(tenantId && clientId && apiScope)
export const msalScopes = apiScope ? [apiScope] : []
export const msalInstance = msalSetupComplete && tenantId && clientId
  ? new PublicClientApplication({
      auth: { clientId, authority: `https://login.microsoftonline.com/${tenantId}`, redirectUri: window.location.origin },
      cache: { cacheLocation: 'sessionStorage' },
    })
  : null