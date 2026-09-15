import { useEffect, useState } from 'react'
import { recordPageView, type PageView } from './pageViews'

interface Viewer {
  email: string
  name?: string
}

/** Records the current viewer's visit to `pageId` and keeps the up-to-date "seen by" list. */
export function usePageViewTracking(
  accessToken: string | null,
  rootFolderId: string | null,
  pageId: string | null,
  viewer: Viewer | null,
): PageView[] {
  const [views, setViews] = useState<PageView[]>([])

  useEffect(() => {
    setViews([])
    if (!accessToken || !rootFolderId || !pageId || !viewer?.email) return

    let cancelled = false
    recordPageView(rootFolderId, pageId, viewer, accessToken)
      .then((result) => {
        if (!cancelled) setViews(result)
      })
      .catch(() => {
        // Non-critical — just skip showing "seen by" if it fails.
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, rootFolderId, pageId, viewer?.email, viewer?.name])

  return views
}
