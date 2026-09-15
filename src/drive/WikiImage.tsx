import { useEffect, useState } from 'react'
import { getAssetBlob } from '../cache/assetCache'
import { isAbsoluteUrl } from './urlUtils'
import type { WikiAsset } from './wikiTree'

interface WikiImageProps {
  src?: string
  alt?: string
  assets: WikiAsset[]
  accessToken: string
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
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img src={src} alt={alt ?? ''} />
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

  // eslint-disable-next-line jsx-a11y/alt-text
  return <img src={objectUrl} alt={alt ?? ''} />
}
