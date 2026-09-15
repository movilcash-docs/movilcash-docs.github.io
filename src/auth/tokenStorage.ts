import type { GoogleUserInfo } from './googleAuth'

const STORAGE_KEY = 'wiki.auth.session'

interface StoredSession {
  accessToken: string
  /** Epoch ms. */
  expiresAt: number
  user: GoogleUserInfo | null
}

/**
 * Access token + user profile, kept in sessionStorage (cleared when the tab/browser closes —
 * unlike localStorage, never survives to a later day). This is what lets a plain page refresh
 * skip Google's auth flow entirely instead of re-running it (and possibly popping a window)
 * every time, as long as the token is still valid.
 */
export function readStoredSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    if (typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

export function writeStoredSession(session: StoredSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Storage unavailable (private mode, quota, etc.) — non-fatal, just skip persisting.
  }
}

export function clearStoredSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
