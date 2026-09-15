import type { WikiSection } from '../drive/wikiTree'
import { getDb } from './db'

export async function getCachedTree(rootFolderId: string): Promise<WikiSection | null> {
  const db = await getDb()
  const entry = await db.get('tree', rootFolderId)
  return entry?.tree ?? null
}

export async function setCachedTree(rootFolderId: string, tree: WikiSection): Promise<void> {
  const db = await getDb()
  await db.put('tree', { rootFolderId, tree, fetchedAt: Date.now() })
}
