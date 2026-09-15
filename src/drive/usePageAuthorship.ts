import { useEffect, useState } from 'react'
import { getFileAuthorship, type DriveFileAuthorship } from './driveApi'

export function usePageAuthorship(accessToken: string | null, fileId: string | null): DriveFileAuthorship | null {
  const [authorship, setAuthorship] = useState<DriveFileAuthorship | null>(null)

  useEffect(() => {
    if (!accessToken || !fileId) {
      setAuthorship(null)
      return
    }

    let cancelled = false
    // Reset immediately so a slow fetch for a new page doesn't briefly show the previous page's byline.
    setAuthorship(null)

    getFileAuthorship(fileId, accessToken)
      .then((result) => {
        if (!cancelled) setAuthorship(result)
      })
      .catch(() => {
        // Non-critical UI — just omit the byline if it fails.
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, fileId])

  return authorship
}
