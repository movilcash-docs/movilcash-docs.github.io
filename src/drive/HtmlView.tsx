import { useEffect, useRef, useState } from 'react'
import { ensureGoogleIdToken, getLatestIdToken, onIdToken, renderGoogleIdButton } from '../auth/googleIdToken'
import { getPageContent } from '../cache/pageCache'
import { DriveApiError } from './driveApi'
import type { WikiHtml } from './wikiTree'

interface HtmlViewProps {
  html: WikiHtml
  accessToken: string
}

// A rendered HTML file acts as a "miniapp": it can ask the wiki for the signed-in user's Google ID
// token (to authenticate against its own backend) by posting a `ready` handshake. The Monitor V2
// dashboard uses the `mc-monitor:*` names; new miniapps (configuradores, tableros de jobs, …) can
// use the generic `mc-miniapp:*` names. Both are accepted/answered identically.
const READY_TYPES = ['mc-monitor:ready', 'mc-miniapp:ready']
const TOKEN_TYPES = ['mc-monitor:google-id-token', 'mc-miniapp:google-id-token']
const CONFIG_TYPES = ['mc-monitor:config', 'mc-miniapp:config']
const MAXIMIZE_TYPES = ['mc-monitor:maximize', 'mc-miniapp:maximize']
const RESTORE_TYPES = ['mc-monitor:restore', 'mc-miniapp:restore']
const MAXIMIZED_TYPES = ['mc-monitor:maximized', 'mc-miniapp:maximized']

// Per-environment API base URL handed to miniapps before the token. Unset → nothing is sent and
// the miniapp uses its own build-time fallback.
const MINIAPP_API_BASE_URL = import.meta.env.VITE_MINIAPP_API_BASE_URL

/**
 * Renders an .html file from Drive inside a sandboxed iframe, so the file's own
 * <style>/<script> and full <head> work as-authored, fully isolated from the wiki
 * (no access to the parent document, cookies, or Drive token). The sandbox grants
 * only script execution — not allow-same-origin — which forces an opaque origin.
 *
 * On top of that isolation, these HTML files work as "miniapps": any of them can request the
 * signed-in user's Google ID token with a postMessage handshake (see the bridge below), so a
 * miniapp can authenticate the current user against its own backend. The strict sandbox is kept —
 * the token is the only thing crossing into the iframe, and a miniapp still can't reach the wiki's
 * DOM, cookies, or Drive access token.
 */
export function HtmlView({ html, accessToken }: HtmlViewProps) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorReason, setErrorReason] = useState<string | null>(null)
  // A miniapp can ask the wiki to make its iframe fill the whole browser viewport (not the OS
  // fullscreen — that's `allowFullScreen`), toggled via the maximize/restore handshake below.
  const [maximized, setMaximized] = useState(false)
  // When the silent Google One Tap / FedCM flow can't obtain an ID token (no FedCM-eligible session,
  // cooldown, blocked cookies), we surface an interactive "Sign in with Google" button instead of
  // leaving the miniapp stuck waiting forever for a token that will never arrive.
  const [needsSignIn, setNeedsSignIn] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const signInButtonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setContent(null)
    setError(null)
    setErrorReason(null)
    let cancelled = false

    getPageContent(html.id, html.modifiedTime, accessToken)
      .then((text) => {
        if (!cancelled) setContent(text)
      })
      .catch((err) => {
        if (cancelled) return
        setError((err as Error).message)
        setErrorReason(err instanceof DriveApiError ? (err.reason ?? null) : null)
      })

    return () => {
      cancelled = true
    }
  }, [html.id, html.modifiedTime, accessToken])

  // Miniapp token bridge: hand the Google ID token to the embedded HTML whenever it announces it's
  // ready (it can reload, so "ready" may arrive repeatedly), and re-send it whenever GIS emits a
  // fresh credential (re-login / refresh). The Google ID flow is only kicked off once an HTML
  // actually asks for it, so plain (non-miniapp) HTML files never trigger it.
  useEffect(() => {
    let ready = false
    // If the silent token doesn't arrive within this grace window after the miniapp announces it's
    // ready, we assume One Tap / FedCM failed silently and reveal the interactive sign-in button.
    const SIGN_IN_GRACE_MS = 2500
    let graceTimer: number | undefined
    // Leaving maximized state / a stale sign-in prompt behind when switching files would be confusing.
    setMaximized(false)
    setNeedsSignIn(false)

    // targetOrigin must be "*" below: the strict sandbox gives the iframe an opaque origin, which
    // no specific origin string can match. Each message is still delivered only to this iframe's
    // own contentWindow, never broadcast to the whole page.
    function sendConfig() {
      const win = iframeRef.current?.contentWindow
      if (!win || !MINIAPP_API_BASE_URL) return
      for (const type of CONFIG_TYPES) win.postMessage({ type, apiBaseUrl: MINIAPP_API_BASE_URL }, '*')
    }

    function pushToken() {
      const win = iframeRef.current?.contentWindow
      const idToken = getLatestIdToken()
      if (!ready || !idToken || !win) return
      // A token is in hand: no need for the fallback button anymore.
      window.clearTimeout(graceTimer)
      setNeedsSignIn(false)
      for (const type of TOKEN_TYPES) win.postMessage({ type, idToken }, '*')
    }

    function confirmMaximized(value: boolean) {
      const win = iframeRef.current?.contentWindow
      if (!win) return
      for (const type of MAXIMIZED_TYPES) win.postMessage({ type, maximized: value }, '*')
    }

    function handleMessage(event: MessageEvent) {
      // The iframe has an opaque origin (event.origin === "null"), so origin can't be checked.
      // The authoritative check is event.source: the message must genuinely come from the window
      // of the iframe we rendered — that can't be forged by another tab/frame.
      if (event.source !== iframeRef.current?.contentWindow) return
      const type = (event.data as { type?: string } | null)?.type
      if (!type) return
      if (READY_TYPES.includes(type)) {
        ready = true
        // Config first (the miniapp expects it before the token), then the token.
        sendConfig()
        // Obtain (or refresh) the Google ID token; it arrives asynchronously via onIdToken, and
        // `ready` is remembered until then.
        void ensureGoogleIdToken().catch(() => {
          // GIS itself failed to load/init (blocked, offline): go straight to the fallback button.
          window.clearTimeout(graceTimer)
          if (!getLatestIdToken()) setNeedsSignIn(true)
        })
        pushToken()
        // If no token is pushed within the grace window, the silent flow failed quietly — offer the
        // interactive sign-in button so the operator can still authenticate.
        window.clearTimeout(graceTimer)
        graceTimer = window.setTimeout(() => {
          if (!getLatestIdToken()) setNeedsSignIn(true)
        }, SIGN_IN_GRACE_MS)
      } else if (MAXIMIZE_TYPES.includes(type)) {
        setMaximized(true)
        confirmMaximized(true)
      } else if (RESTORE_TYPES.includes(type)) {
        setMaximized(false)
        confirmMaximized(false)
      }
    }

    window.addEventListener('message', handleMessage)
    const unsubscribe = onIdToken(pushToken) // re-push on every new credential
    return () => {
      window.removeEventListener('message', handleMessage)
      unsubscribe()
      window.clearTimeout(graceTimer)
    }
  }, [html.id])

  // Render the GIS "Sign in with Google" button once the fallback is shown. A successful click
  // delivers a credential through onIdToken → pushToken, which clears needsSignIn and hides this.
  useEffect(() => {
    if (!needsSignIn || !signInButtonRef.current) return
    void renderGoogleIdButton(signInButtonRef.current).catch(() => {
      // Even rendering the button failed (GIS unavailable); nothing else to offer here.
    })
  }, [needsSignIn])

  if (error) {
    return (
      <p className="text-destructive">
        {errorReason === 'fileNotDownloadable'
          ? `"${html.name}" no es un archivo HTML de texto que la wiki pueda leer.`
          : `Error cargando el HTML: ${error}`}
      </p>
    )
  }
  if (content === null) return <p className="text-muted-foreground text-sm">Cargando HTML…</p>

  return (
    <>
      <iframe
        ref={iframeRef}
        srcDoc={content}
        title={html.name}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
        allow="fullscreen"
        className={
          maximized
            ? 'fixed inset-0 z-[9999] h-screen w-screen border-0 bg-white'
            : 'h-[80vh] w-full rounded-md border bg-white'
        }
      />
      {needsSignIn && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-white p-6 text-center shadow-lg">
            <p className="text-sm text-gray-700">
              Iniciá sesión con Google para usar esta miniapp
            </p>
            <div ref={signInButtonRef} className="flex justify-center" />
          </div>
        </div>
      )}
    </>
  )
}
