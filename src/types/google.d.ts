// Minimal ambient types for the subset of Google Identity Services (GIS) and
// the Picker API (loaded via <script> tags, see index.html) that this app uses.
// There is no official @types package for these — they're plain globals.

declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token: string
    expires_in: number
    scope: string
    token_type: string
    error?: string
    error_description?: string
  }

  interface TokenClientConfig {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: { type: string; message?: string }) => void
  }

  interface TokenClient {
    requestAccessToken: (overrideConfig?: { prompt?: '' | 'none' | 'consent' | 'select_account' }) => void
  }

  function initTokenClient(config: TokenClientConfig): TokenClient
  function revoke(accessToken: string, callback?: () => void): void
}

interface Window {
  google?: typeof google
  gapi?: {
    load: (api: string, callback: () => void) => void
  }
}

declare namespace google.picker {
  enum ViewId {
    FOLDERS = 'folders',
  }

  class DocsView {
    constructor(viewId?: ViewId)
    setIncludeFolders(include: boolean): this
    setSelectFolderEnabled(enabled: boolean): this
    setMimeTypes(mimeTypes: string): this
    setParent(parentId: string): this
  }

  enum Action {
    PICKED = 'picked',
    CANCEL = 'cancel',
  }

  interface PickerResponseDoc {
    id: string
    name: string
    mimeType: string
  }

  interface PickerResponse {
    action: Action
    docs: PickerResponseDoc[]
  }

  class PickerBuilder {
    addView(view: DocsView): this
    setOAuthToken(token: string): this
    setDeveloperKey(key: string): this
    setCallback(callback: (response: PickerResponse) => void): this
    setTitle(title: string): this
    build(): Picker
  }

  class Picker {
    setVisible(visible: boolean): void
  }
}
