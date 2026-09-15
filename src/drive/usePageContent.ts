import { useEffect, useState } from 'react'
import { getPageContent } from '../cache/pageCache'
import { DriveApiError } from './driveApi'
import type { WikiPage } from './wikiTree'

interface UsePageContentResult {
  content: string | null
  isLoading: boolean
  error: string | null
  /** Drive's machine-readable error reason (e.g. "fileNotDownloadable" for a Google Doc masquerading as .md). */
  errorReason: string | null
}

export function usePageContent(accessToken: string | null, page: WikiPage | null): UsePageContentResult {
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorReason, setErrorReason] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || !page) {
      setContent(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)
    setErrorReason(null)

    getPageContent(page.id, page.modifiedTime, accessToken)
      .then((text) => {
        if (!cancelled) setContent(text)
      })
      .catch((err) => {
        if (cancelled) return
        setError((err as Error).message)
        setErrorReason(err instanceof DriveApiError ? (err.reason ?? null) : null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, page])

  return { content, isLoading, error, errorReason }
}
