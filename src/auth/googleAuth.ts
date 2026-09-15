import { loadScript } from '../lib/loadScript'

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
// `email profile` adds basic account info (for the top bar) on top of Drive access;
// both are non-sensitive scopes Google grants without extra consent-screen setup.
const SCOPES = 'https://www.googleapis.com/auth/drive email profile'

let tokenClient: google.accounts.oauth2.TokenClient | undefined
let pendingResolve: ((token: string) => void) | undefined
let pendingReject: ((error: Error) => void) | undefined

function settlePending(fn: () => void) {
  fn()
  pendingResolve = undefined
  pendingReject = undefined
}

async function getTokenClient(): Promise<google.accounts.oauth2.TokenClient> {
  if (tokenClient) return tokenClient

  await loadScript(GIS_SCRIPT_URL)
  if (!window.google) {
    throw new Error('Google Identity Services failed to load')
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: (response) => {
      settlePending(() => {
        if (response.error) {
          pendingReject?.(new Error(response.error_description ?? response.error))
        } else {
          pendingResolve?.(response.access_token)
        }
      })
    },
    error_callback: (error) => {
      settlePending(() => pendingReject?.(new Error(error.message ?? error.type)))
    },
  })
  return tokenClient
}

export interface RequestTokenOptions {
  /** 'none' attempts a silent grant (no popup) using the existing Google session. */
  prompt?: 'none' | 'consent' | 'select_account'
}

export async function requestAccessToken(options: RequestTokenOptions = {}): Promise<string> {
  const client = await getTokenClient()

  return new Promise<string>((resolve, reject) => {
    pendingResolve = resolve
    pendingReject = reject
    client.requestAccessToken({ prompt: options.prompt === 'none' ? '' : options.prompt })
  })
}

export interface GoogleUserInfo {
  email: string
  name?: string
  picture?: string
}

export async function getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.status}`)
  }
  return response.json()
}

export function revokeAccessToken(accessToken: string): Promise<void> {
  return new Promise((resolve) => {
    if (!window.google) {
      resolve()
      return
    }
    window.google.accounts.oauth2.revoke(accessToken, () => resolve())
  })
}
