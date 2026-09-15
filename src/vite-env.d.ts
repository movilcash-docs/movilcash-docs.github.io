/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_GOOGLE_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Build timestamp (UTC, YYYYMMDDHHmm), injected at build time — see vite.config.ts. */
declare const __BUILD_ID__: string
