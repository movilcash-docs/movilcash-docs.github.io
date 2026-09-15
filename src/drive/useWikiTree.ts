import { useCallback, useEffect, useState } from 'react'
import { getCachedTree, setCachedTree } from '../cache/treeCache'
import { buildWikiTree, type WikiSection } from './wikiTree'

interface UseWikiTreeResult {
  tree: WikiSection | null
  /** true only on the very first load with nothing cached yet; a background refresh doesn't set this. */
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
    const token = accessToken
    const folderId = rootFolderId
    const folderName = rootFolderName

    let cancelled = false

    async function run() {
      const cached = await getCachedTree(folderId)
      if (cancelled) return

      setError(null)
      if (cached) {
        setTree(cached)
      } else {
        setIsLoading(true)
      }

      // Always revalidate against Drive in the background — listing folders is cheap
      // metadata-only calls, and it's how we discover new/renamed/deleted pages.
      // The expensive part (page text, image bytes) stays cached via modifiedTime checks.
      try {
        const fresh = await buildWikiTree(folderId, folderName, token)
        if (cancelled) return
        setTree(fresh)
        void setCachedTree(folderId, fresh)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [accessToken, rootFolderId, rootFolderName, refreshToken])

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), [])

  return { tree, isLoading, error, refresh }
}
