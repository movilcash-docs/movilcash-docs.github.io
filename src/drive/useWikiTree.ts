import { useCallback, useEffect, useState } from 'react'
import { buildWikiTree, type WikiSection } from './wikiTree'

interface UseWikiTreeResult {
  tree: WikiSection | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useWikiTree(
  accessToken: string | null,
  rootFolderId: string | null,
  rootFolderName: string | null,
): UseWikiTreeResult {
  const [tree, setTree] = useState<WikiSection | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    if (!accessToken || !rootFolderId || !rootFolderName) {
      setTree(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    buildWikiTree(rootFolderId, rootFolderName, accessToken)
      .then((result) => {
        if (!cancelled) setTree(result)
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
  }, [accessToken, rootFolderId, rootFolderName, refreshToken])

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), [])

  return { tree, isLoading, error, refresh }
}
