import { useEffect, useState } from 'react'
import { getPageContent } from '../cache/pageCache'
import { DriveApiError } from './driveApi'
import type { WikiHtml } from './wikiTree'

interface HtmlViewProps {
  html: WikiHtml
  accessToken: string
}

/**
 * Renders an .html file from Drive inside a sandboxed iframe, so the file's own
 * <style>/<script> and full <head> work as-authored, fully isolated from the wiki
 * (no access to the parent document, cookies, or Drive token). The sandbox grants
 * only script execution — not allow-same-origin — which forces an opaque origin.
 */
export function HtmlView({ html, accessToken }: HtmlViewProps) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorReason, setErrorReason] = useState<string | null>(null)

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
    <iframe
      srcDoc={content}
      title={html.name}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
      className="h-[80vh] w-full rounded-md border bg-white"
    />
  )
}
