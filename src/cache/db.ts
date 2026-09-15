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
    dbPromise = openDB<WikiCacheSchema>('movilcash-wiki-cache', 2, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          db.createObjectStore('tree', { keyPath: 'rootFolderId' })
          db.createObjectStore('pages', { keyPath: 'fileId' })
          db.createObjectStore('assets', { keyPath: 'fileId' })
        }
        // v2: WikiSection gained a `notebooks` field — cached trees from before that are
        // missing it and would crash the tree view, so just drop the (cheap to rebuild) cache.
        if (oldVersion < 2) {
          transaction.objectStore('tree').clear()
        }
      },
    })
  }
  return dbPromise
}
