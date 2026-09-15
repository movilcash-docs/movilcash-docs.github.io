import { useEffect, useState } from 'react'
import { getPageContent } from '../cache/pageCache'
import type { WikiPage } from './wikiTree'

interface UsePageContentResult {
  content: string | null
  isLoading: boolean
  error: string | null
}

export function usePageContent(accessToken: string | null, page: WikiPage | null): UsePageContentResult {
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || !page) {
      setContent(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    getPageContent(page.id, page.modifiedTime, accessToken)
      .then((text) => {
        if (!cancelled) setContent(text)
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, page])

  return { content, isLoading, error }
}
