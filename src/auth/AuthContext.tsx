import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { requestAccessToken, revokeAccessToken } from './googleAuth'

interface AuthState {
  accessToken: string | null
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

// Access tokens for the `drive` scope are short-lived (~1h) and not persisted
// across reloads for security; on mount we try a silent, no-popup grant that
// succeeds only if the browser still has a live Google session/consent.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ accessToken: null, isLoading: true, error: null })
  const expiryTimer = useRef<number | undefined>(undefined)

  const scheduleExpiry = useCallback((expiresInSeconds: number) => {
    window.clearTimeout(expiryTimer.current)
    // Clear the token a bit early so a stale token isn't used for a request that's mid-flight.
    const marginMs = 60_000
    expiryTimer.current = window.setTimeout(
      () => setState((s) => ({ ...s, accessToken: null })),
      Math.max(expiresInSeconds * 1000 - marginMs, 0),
    )
  }, [])

  const signIn = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }))
    try {
      const token = await requestAccessToken({ prompt: 'consent' })
      setState({ accessToken: token, isLoading: false, error: null })
      scheduleExpiry(3600)
    } catch (err) {
      setState({ accessToken: null, isLoading: false, error: (err as Error).message })
    }
  }, [scheduleExpiry])

  const signOut = useCallback(async () => {
    window.clearTimeout(expiryTimer.current)
    if (state.accessToken) {
      await revokeAccessToken(state.accessToken)
    }
    setState({ accessToken: null, isLoading: false, error: null })
  }, [state.accessToken])

  useEffect(() => {
    let cancelled = false
    requestAccessToken({ prompt: 'none' })
      .then((token) => {
        if (cancelled) return
        setState({ accessToken: token, isLoading: false, error: null })
        scheduleExpiry(3600)
      })
      .catch(() => {
        if (cancelled) return
        // No prior session/consent — this is the normal state for a first visit.
        setState({ accessToken: null, isLoading: false, error: null })
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
