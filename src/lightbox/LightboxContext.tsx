import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { ImageLightboxDialog } from './ImageLightboxDialog'

export type LightboxContent = { kind: 'image'; src: string; alt?: string } | { kind: 'svg'; markup: string }

interface LightboxContextValue {
  openLightbox: (content: LightboxContent) => void
}

const LightboxContext = createContext<LightboxContextValue | undefined>(undefined)

/** Provides a single shared image/diagram zoom modal, usable from anywhere (page view, editor preview, notebooks). */
export function LightboxProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<LightboxContent | null>(null)

  const openLightbox = useCallback((next: LightboxContent) => setContent(next), [])

  return (
    <LightboxContext.Provider value={{ openLightbox }}>
      {children}
      <ImageLightboxDialog content={content} onOpenChange={(open) => !open && setContent(null)} />
    </LightboxContext.Provider>
  )
}

export function useLightbox(): LightboxContextValue {
  const ctx = useContext(LightboxContext)
  if (!ctx) throw new Error('useLightbox must be used within a LightboxProvider')
  return ctx
}
