import { ZoomIn } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getAssetBlob } from '../cache/assetCache'
import { useLightbox } from '../lightbox/LightboxContext'
import { isAbsoluteUrl } from './urlUtils'
import type { WikiAsset } from './wikiTree'

interface WikiImageProps {
  src?: string
  alt?: string
  assets: WikiAsset[]
  accessToken: string
}

function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const { openLightbox } = useLightbox()
  return (
    <span className="group relative my-4 block">
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img src={src} alt={alt} className="m-0" />
      <button
        type="button"
        aria-label="Ampliar imagen"
        className="absolute top-2 right-2 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
        onClick={() => openLightbox({ kind: 'image', src, alt })}
      >
        <ZoomIn className="size-4" />
      </button>
    </span>
  )
}

export function WikiImage({ src, alt, assets, accessToken }: WikiImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const relativeName = src ? decodeURIComponent(src.replace(/^\.\//, '')) : ''
  const asset = assets.find((a) => a.name === relativeName)

  useEffect(() => {
    setObjectUrl(null)
    setError(null)
    if (!asset) return

    let cancelled = false
    let createdUrl: string | null = null

    getAssetBlob(asset.id, asset.modifiedTime, accessToken)
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
  }, [asset, accessToken])

  if (src && isAbsoluteUrl(src)) {
    return <ZoomableImage src={src} alt={alt ?? ''} />
  }

  if (!asset) {
    return (
      <span className="text-muted-foreground inline-block text-sm italic">
        [imagen no encontrada: {relativeName || alt}]
      </span>
    )
  }

  if (error) {
    return (
      <span className="text-muted-foreground inline-block text-sm italic">
        [error cargando {relativeName}: {error}]
      </span>
    )
  }

  if (!objectUrl) {
    return <span className="text-muted-foreground inline-block text-sm italic">Cargando imagen…</span>
  }

  return <ZoomableImage src={objectUrl} alt={alt ?? ''} />
}
