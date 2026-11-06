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
let initPromise: Promise<void> | null = null
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
 * Load GIS and initialize the ID flow exactly once (idempotent, concurrency-safe). Both the silent
 * One Tap attempt and the interactive "Sign in with Google" button share this single initialization
 * and the same `handleCredential` callback, so a credential from either path flows to subscribers.
 */
async function initGis(): Promise<void> {
  if (initialized) return
  if (!initPromise) {
    initPromise = (async () => {
      await loadScript(GIS_SCRIPT_URL)
      if (!window.google) throw new Error('Google Identity Services failed to load')
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleCredential,
        auto_select: true,
        use_fedcm_for_prompt: true,
      })
      initialized = true
    })().catch((err) => {
      initPromise = null // allow a later retry
      throw err
    })
  }
  return initPromise
}

/**
 * Initialize the GIS ID flow (idempotent) and request a credential silently via One Tap / FedCM.
 * The token is delivered asynchronously to `onIdToken` subscribers; callers shouldn't await a token
 * here. Safe to call every time a miniapp is opened — if already initialized it only nudges a
 * refresh when the cached token is missing or about to expire. The silent prompt can quietly fail
 * (no FedCM-eligible session, cooldown, third-party cookies blocked); use `renderGoogleIdButton` as
 * the user-initiated fallback for that case.
 */
export async function ensureGoogleIdToken(): Promise<void> {
  await initGis()
  if (isStaleOrMissing()) window.google?.accounts.id.prompt()
}

/**
 * Render a "Sign in with Google" button into `container` as the interactive fallback when the silent
 * One Tap / FedCM flow couldn't obtain a credential. A click runs the full account-chooser flow,
 * which doesn't depend on a silent FedCM session; the resulting credential reaches subscribers
 * through the same `handleCredential` callback as the silent path.
 */
export async function renderGoogleIdButton(container: HTMLElement): Promise<void> {
  await initGis()
  window.google?.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'pill',
  })
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
