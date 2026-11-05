/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_GOOGLE_API_KEY: string
  /**
   * Per-environment API base URL sent to embedded HTML miniapps via a `*:config` postMessage
   * before the ID token. Unset → no config is sent and the miniapp uses its own build-time
   * fallback.
   */
  readonly VITE_MINIAPP_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Build timestamp (UTC, YYYYMMDDHHmm), injected at build time — see vite.config.ts. */
declare const __BUILD_ID__: string
