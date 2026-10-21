/* eslint-disable react-refresh/only-export-components -- the session provider and its hooks belong together */
import { createContext, useCallback, useContext, type ReactNode } from 'react'
import { MsalProvider, useIsAuthenticated, useMsal } from '@azure/msal-react'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { devAuthBypass, msalInstance, msalScopes, msalSetupComplete } from './auth'
import { apiRequest, type AuthenticatedRequest } from './lib/api/client'
import { SetupScreen } from './components/layout/SetupScreen'

export interface PortalSession { authenticated: boolean; userId: string; displayName: string; isAdmin: boolean; isLocal: boolean; request: AuthenticatedRequest; signIn: () => Promise<void>; signOut: () => Promise<void> }

const SessionContext = createContext<PortalSession | null>(null)
const localSession: PortalSession = { authenticated: true, userId: 'local-developer', displayName: 'Local Developer', isAdmin: import.meta.env.VITE_LOCAL_IS_ADMIN === 'true', isLocal: true, request: apiRequest, signIn: async () => {}, signOut: async () => {} }

/** Provides the signed-in session: local bypass, Entra setup screen, or MSAL-backed Entra session. */
export function SessionProvider({ children }: { children: ReactNode }) {
  if (devAuthBypass) return <SessionContext.Provider value={localSession}>{children}</SessionContext.Provider>
  if (!msalSetupComplete || !msalInstance) return <SetupScreen />
  return <MsalProvider instance={msalInstance}><EntraSessionProvider>{children}</EntraSessionProvider></MsalProvider>
}

function EntraSessionProvider({ children }: { children: ReactNode }) {
  const authenticated = useIsAuthenticated()
  const { instance, accounts } = useMsal()
  const account = accounts[0]
  const claims = account?.idTokenClaims as { oid?: string; roles?: string[] } | undefined
  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    if (!account) throw new Error('Sign in to continue.')
    const headers = new Headers(init?.headers)
    try { const token = await instance.acquireTokenSilent({ scopes: msalScopes, account }); headers.set('Authorization', `Bearer ${token.accessToken}`) }
    catch (error) {
      if (!(error instanceof InteractionRequiredAuthError)) throw error
      const token = await instance.acquireTokenPopup({ scopes: msalScopes, account }); headers.set('Authorization', `Bearer ${token.accessToken}`)
    }
    return apiRequest<T>(path, { ...init, headers })
  }, [account, instance])
  const session: PortalSession = {
    authenticated,
    userId: claims?.oid ?? '',
    displayName: account?.name ?? 'Company account',
    isAdmin: claims?.roles?.includes('Upskill.Admin') ?? false,
    isLocal: false,
    request,
    signIn: async () => { await instance.loginPopup({ scopes: msalScopes }) },
    signOut: async () => { await instance.logoutPopup({ account }) },
  }
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('Upskill session context is unavailable.')
  return session
}

/** Authenticated request function: attaches the Entra access token (or nothing in local bypass mode). */
export function useApi() { return useSession().request }
