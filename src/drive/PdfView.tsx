import { useEffect, useState } from 'react'
import { getAssetBlob } from '../cache/assetCache'
import type { WikiPdf } from './wikiTree'

interface PdfViewProps {
  pdf: WikiPdf
  accessToken: string
}

export function PdfView({ pdf, accessToken }: PdfViewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setObjectUrl(null)
    setError(null)
    let cancelled = false
    let createdUrl: string | null = null

    getAssetBlob(pdf.id, pdf.modifiedTime, accessToken)
      .then((blob) => {
        if (cancelled) return
        createdUrl = URL.createObjectURL(blob)
        setObjectUrl(createdUrl)
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message)
      })

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [pdf.id, pdf.modifiedTime, accessToken])

  if (error) return <p className="text-destructive">Error cargando el PDF: {error}</p>
  if (!objectUrl) return <p className="text-muted-foreground text-sm">Cargando PDF…</p>

  return <iframe src={objectUrl} title={pdf.name} className="h-[80vh] w-full rounded-md border" />
}
