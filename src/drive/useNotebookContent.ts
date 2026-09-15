import { useEffect, useState } from 'react'
import { getPageContent } from '../cache/pageCache'
import { DriveApiError } from './driveApi'
import { parseNotebook, type NotebookDoc } from './notebook'
import type { WikiNotebook } from './wikiTree'

interface UseNotebookContentResult {
  notebook: NotebookDoc | null
  isLoading: boolean
  error: string | null
  errorReason: string | null
}

export function useNotebookContent(accessToken: string | null, file: WikiNotebook | null): UseNotebookContentResult {
  const [notebook, setNotebook] = useState<NotebookDoc | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorReason, setErrorReason] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || !file) {
      setNotebook(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)
    setErrorReason(null)

    getPageContent(file.id, file.modifiedTime, accessToken)
      .then((raw) => {
        if (!cancelled) setNotebook(parseNotebook(raw))
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
  }, [accessToken, file])

  return { notebook, isLoading, error, errorReason }
}
