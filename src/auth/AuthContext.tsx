import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { getUserInfo, requestAccessToken, revokeAccessToken, type GoogleUserInfo } from './googleAuth'
import { clearStoredSession, readStoredSession, writeStoredSession } from './tokenStorage'

interface AuthState {
  accessToken: string | null
  user: GoogleUserInfo | null
  /** true while attempting the initial silent sign-in, or a manual sign-in */
  isLoading: boolean
  error: string | null
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const INITIAL_STATE: AuthState = { accessToken: null, user: null, isLoading: true, error: null }
const TOKEN_LIFETIME_SECONDS = 3600
// Attempt a silent refresh this far ahead of the real expiry, instead of waiting for the token to
// actually die — as long as the browser still has a live Google session, this keeps the tab logged
// in indefinitely without the user noticing. Only falls back to the login screen if that silent
// attempt itself fails (no session, third-party cookies blocked, unverified-app limits, etc.).
const REFRESH_MARGIN_MS = 5 * 60_000

// Access tokens are kept in localStorage (see tokenStorage.ts) so the session survives a page
// refresh *and* closing the browser — not just re-running Google's auth flow, which can pop a
// window even for a "silent" attempt (more likely for an unverified/"Testing" app requesting the
// full Drive scope, which is our case) — for as long as the token itself is still valid.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE)
  const refreshTimer = useRef<number | undefined>(undefined)
  const applyTokenRef = useRef<(token: string, expiresInSeconds?: number) => Promise<void>>(undefined)

  const scheduleRefresh = useCallback((expiresInMs: number) => {
    window.clearTimeout(refreshTimer.current)
    const delay = Math.max(expiresInMs - REFRESH_MARGIN_MS, 0)
    refreshTimer.current = window.setTimeout(async () => {
      try {
        const token = await requestAccessToken({ prompt: 'none' })
        await applyTokenRef.current?.(token)
      } catch {
        // Silent refresh failed (session gone, cookies blocked, etc.) — nothing left to do but
        // show the login screen; a manual signIn() will pop the interactive consent flow.
        clearStoredSession()
        setState((s) => ({ ...s, accessToken: null, user: null }))
      }
    }, delay)
  }, [])

  const applyToken = useCallback(
    async (token: string, expiresInSeconds: number = TOKEN_LIFETIME_SECONDS) => {
      const user = await getUserInfo(token).catch(() => null)
      setState({ accessToken: token, user, isLoading: false, error: null })
      const expiresAt = Date.now() + expiresInSeconds * 1000
      writeStoredSession({ accessToken: token, expiresAt, user })
      scheduleRefresh(expiresInSeconds * 1000)
    },
    [scheduleRefresh],
  )

  useEffect(() => {
    applyTokenRef.current = applyToken
  }, [applyToken])

  const signIn = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }))
    try {
      const token = await requestAccessToken({ prompt: 'consent' })
      await applyToken(token)
    } catch (err) {
      setState({ accessToken: null, user: null, isLoading: false, error: (err as Error).message })
    }
  }, [applyToken])

  const signOut = useCallback(async () => {
    window.clearTimeout(refreshTimer.current)
    clearStoredSession()
    if (state.accessToken) {
      await revokeAccessToken(state.accessToken)
    }
    setState({ accessToken: null, user: null, isLoading: false, error: null })
  }, [state.accessToken])

  useEffect(() => {
    const stored = readStoredSession()
    if (stored) {
      setState({ accessToken: stored.accessToken, user: stored.user, isLoading: false, error: null })
      scheduleRefresh(stored.expiresAt - Date.now())
      return
    }

    let cancelled = false
    requestAccessToken({ prompt: 'none' })
      .then(async (token) => {
        if (cancelled) return
        await applyToken(token)
      })
      .catch(() => {
        if (cancelled) return
        // No prior session/consent — this is the normal state for a first visit.
        setState({ accessToken: null, user: null, isLoading: false, error: null })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthContext.Provider
      value={{ ...state, isAuthenticated: state.accessToken !== null, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
