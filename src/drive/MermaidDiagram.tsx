import mermaid from 'mermaid'
import { useEffect, useId, useState } from 'react'
import { useTheme } from '../theme/useTheme'

interface MermaidDiagramProps {
  code: string
}

let initializedTheme: 'light' | 'dark' | null = null

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const { theme } = useTheme()
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

  // Mermaid produces the SVG itself (securityLevel "strict" sanitizes it) — nothing here comes
  // from unescaped page text beyond what mermaid's own parser already validated.
  return <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />
}
