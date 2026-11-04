import { loadScript } from '../lib/loadScript'

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
// Refresh this far ahead of the token's real `exp`, so the monitor never gets a credential that's
// about to die mid-request.
const REFRESH_MARGIN_MS = 5 * 60_000

/**
 * Obtains a Google **ID token** (the `credential` JWT from Google Identity Services) for the
 * signed-in account, reusing the same OAuth client id as the rest of the app. This is separate
 * from the Drive **access token** the app uses everywhere else (see googleAuth.ts): the embedded
 * HTML "miniapps" (the Monitor V2 dashboard, configuradores, job boards, …) need a verifiable ID
 * token (with `email`, `aud`, `hd` claims) that their own backends validate to authorize the
 * current user's requests — not a Drive access token.
 *
 * One Tap with `auto_select` makes this silent whenever the browser already has a single active
 * Google session — which is our case, since the wiki itself is already signed in — so no extra
 * user interaction is required in the normal path.
 */

type Listener = (idToken: string | null) => void

let initialized = false
let latestIdToken: string | null = null
let refreshTimer: number | undefined
const listeners = new Set<Listener>()

/** Decode the `exp` (epoch ms) from a JWT without verifying it — only used to time the refresh. */
function decodeExpMs(jwt: string): number | null {
  try {
    const payload = jwt.split('.')[1]
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

function isStaleOrMissing(): boolean {
  if (!latestIdToken) return true
  const exp = decodeExpMs(latestIdToken)
  return exp !== null && exp - Date.now() < REFRESH_MARGIN_MS
}

function notify() {
  for (const listener of listeners) listener(latestIdToken)
}

function scheduleRefresh() {
  window.clearTimeout(refreshTimer)
  if (!latestIdToken) return
  const exp = decodeExpMs(latestIdToken)
  if (exp === null) return
  const delay = Math.max(exp - Date.now() - REFRESH_MARGIN_MS, 0)
  refreshTimer = window.setTimeout(() => {
    // Don't surface a One Tap prompt when nothing is currently consuming the token (e.g. the
    // monitor isn't open). ensureGoogleIdToken() re-triggers a refresh when it's reopened.
    if (listeners.size === 0) return
    window.google?.accounts.id.prompt()
  }, delay)
}

function handleCredential(response: google.accounts.id.CredentialResponse) {
  latestIdToken = response.credential
  notify()
  scheduleRefresh()
}

/**
 * Initialize the GIS ID flow (idempotent) and request a credential. The token is delivered
 * asynchronously to `onIdToken` subscribers; callers shouldn't await a token here. Safe to call
 * every time the monitor is opened — if already initialized it only nudges a refresh when the
 * cached token is missing or about to expire.
 */
export async function ensureGoogleIdToken(): Promise<void> {
  if (initialized) {
    if (isStaleOrMissing()) window.google?.accounts.id.prompt()
    return
  }
  initialized = true

  try {
    await loadScript(GIS_SCRIPT_URL)
  } catch (err) {
    initialized = false
    throw err
  }
  if (!window.google) {
    initialized = false
    throw new Error('Google Identity Services failed to load')
  }

  window.google.accounts.id.initialize({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    callback: handleCredential,
    auto_select: true,
    use_fedcm_for_prompt: true,
  })
  window.google.accounts.id.prompt()
}

export function getLatestIdToken(): string | null {
  return latestIdToken
}

/** Subscribe to credential updates (initial grant and every re-login/refresh). */
export function onIdToken(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
