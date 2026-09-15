import type { GoogleUserInfo } from './googleAuth'

const STORAGE_KEY = 'wiki.auth.session'

interface StoredSession {
  accessToken: string
  /** Epoch ms. */
  expiresAt: number
  user: GoogleUserInfo | null
}

/**
 * Access token + user profile, kept in localStorage so the session survives closing the tab or
 * the whole browser — not just a plain refresh — for as long as the token itself is still valid
 * (checked below via `expiresAt`; Google tokens are short-lived, ~1h, regardless of where they're
 * stored). This is what lets reopening the app skip Google's auth flow entirely instead of
 * re-running it (and possibly popping a window) every time.
 */
export function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Storage unavailable (private mode, quota, etc.) — non-fatal, just skip persisting.
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
