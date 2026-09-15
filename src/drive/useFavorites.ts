import { useCallback, useEffect, useState } from 'react'

function storageKey(rootFolderId: string) {
  return `wiki.favorites.${rootFolderId}`
}

function readFavorites(rootFolderId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(rootFolderId))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

interface UseFavoritesResult {
  favoriteIds: Set<string>
  isFavorite: (pageId: string) => boolean
  toggleFavorite: (pageId: string) => void
}

/** Starred pages, persisted per wiki folder (favorites don't carry over between different wikis). */
export function useFavorites(rootFolderId: string): UseFavoritesResult {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => readFavorites(rootFolderId))

  useEffect(() => {
    setFavoriteIds(readFavorites(rootFolderId))
  }, [rootFolderId])

  const toggleFavorite = useCallback(
    (pageId: string) => {
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        if (next.has(pageId)) next.delete(pageId)
        else next.add(pageId)
        localStorage.setItem(storageKey(rootFolderId), JSON.stringify([...next]))
        return next
      })
    },
    [rootFolderId],
  )

  const isFavorite = useCallback((pageId: string) => favoriteIds.has(pageId), [favoriteIds])

  return { favoriteIds, isFavorite, toggleFavorite }
}
