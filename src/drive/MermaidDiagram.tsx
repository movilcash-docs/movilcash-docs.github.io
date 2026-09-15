import { ZoomIn } from 'lucide-react'
import mermaid from 'mermaid'
import { useEffect, useId, useState } from 'react'
import { useLightbox } from '../lightbox/LightboxContext'
import { useTheme } from '../theme/useTheme'

interface MermaidDiagramProps {
  code: string
}

let initializedTheme: 'light' | 'dark' | null = null

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const { theme } = useTheme()
  const { openLightbox } = useLightbox()
  const id = useId().replace(/:/g, '')
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (initializedTheme !== theme) {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: theme === 'dark' ? 'dark' : 'default' })
      initializedTheme = theme
    }

    mermaid
      .render(`mermaid-${id}`, code)
      .then(({ svg }) => {
        if (!cancelled) {
          setSvg(svg)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message)
      })

    return () => {
      cancelled = true
    }
  }, [code, theme, id])

  if (error) {
    return <pre className="text-destructive text-sm whitespace-pre-wrap">Error en el diagrama Mermaid: {error}</pre>
  }
  if (!svg) {
    return <p className="text-muted-foreground text-sm">Renderizando diagrama…</p>
  }

  return (
    <span className="group relative my-4 block">
      {/* Mermaid produces the SVG itself (securityLevel "strict" sanitizes it) — nothing here
          comes from unescaped page text beyond what mermaid's own parser already validated. */}
      <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />
      <button
        type="button"
        aria-label="Ampliar diagrama"
        className="absolute top-2 right-2 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
        onClick={() => openLightbox({ kind: 'svg', markup: svg })}
      >
        <ZoomIn className="size-4" />
      </button>
    </span>
  )
}
