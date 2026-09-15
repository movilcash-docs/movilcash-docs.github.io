import { useEffect, useState } from 'react'
import { getFileText } from './driveApi'

interface UsePageContentResult {
  content: string | null
  isLoading: boolean
  error: string | null
}

export function usePageContent(accessToken: string | null, pageId: string | null): UsePageContentResult {
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || !pageId) {
      setContent(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    getFileText(pageId, accessToken)
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
  }, [accessToken, pageId])

  return { content, isLoading, error }
}
