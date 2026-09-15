import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { WikiSection } from '../drive/wikiTree'

interface WikiCacheSchema extends DBSchema {
  tree: {
    key: string // rootFolderId
    value: { rootFolderId: string; tree: WikiSection; fetchedAt: number }
  }
  pages: {
    key: string // fileId
    value: { fileId: string; content: string; modifiedTime: string }
  }
  assets: {
    key: string // fileId
    value: { fileId: string; blob: Blob; modifiedTime: string }
  }
}

let dbPromise: Promise<IDBPDatabase<WikiCacheSchema>> | undefined

export function getDb(): Promise<IDBPDatabase<WikiCacheSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<WikiCacheSchema>('movilcash-wiki-cache', 3, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          db.createObjectStore('tree', { keyPath: 'rootFolderId' })
          db.createObjectStore('pages', { keyPath: 'fileId' })
          db.createObjectStore('assets', { keyPath: 'fileId' })
        }
        // Any WikiSection shape change (new field, etc.) needs a version bump here, clearing
        // 'tree' — it's just a cache, cheap to rebuild, but a stale shape crashes the tree view.
        // v2: added `notebooks`. v3: added `pdfs` and `googleFiles`.
        if (oldVersion < 3) {
          transaction.objectStore('tree').clear()
        }
      },
    })
  }
  return dbPromise
}
