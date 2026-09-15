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
// Cleared a bit before the real expiry so a stale token isn't used for a request that's mid-flight.
const EXPIRY_MARGIN_MS = 60_000

// Access tokens are kept in localStorage (see tokenStorage.ts) so the session survives a page
// refresh *and* closing the browser — not just re-running Google's auth flow, which can pop a
// window even for a "silent" attempt (more likely for an unverified/"Testing" app requesting the
// full Drive scope, which is our case) — for as long as the token itself is still valid.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE)
  const expiryTimer = useRef<number | undefined>(undefined)

  const scheduleExpiry = useCallback((expiresInMs: number) => {
    window.clearTimeout(expiryTimer.current)
    expiryTimer.current = window.setTimeout(() => {
      clearStoredSession()
      setState((s) => ({ ...s, accessToken: null, user: null }))
    }, Math.max(expiresInMs - EXPIRY_MARGIN_MS, 0))
  }, [])

  const applyToken = useCallback(
    async (token: string, expiresInSeconds: number = TOKEN_LIFETIME_SECONDS) => {
      const user = await getUserInfo(token).catch(() => null)
      setState({ accessToken: token, user, isLoading: false, error: null })
      const expiresAt = Date.now() + expiresInSeconds * 1000
      writeStoredSession({ accessToken: token, expiresAt, user })
      scheduleExpiry(expiresInSeconds * 1000)
    },
    [scheduleExpiry],
  )

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
    window.clearTimeout(expiryTimer.current)
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
      scheduleExpiry(stored.expiresAt - Date.now())
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
