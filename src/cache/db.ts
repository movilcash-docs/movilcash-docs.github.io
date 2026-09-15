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
    dbPromise = openDB<WikiCacheSchema>('movilcash-wiki-cache', 1, {
      upgrade(db) {
        db.createObjectStore('tree', { keyPath: 'rootFolderId' })
        db.createObjectStore('pages', { keyPath: 'fileId' })
        db.createObjectStore('assets', { keyPath: 'fileId' })
      },
    })
  }
  return dbPromise
}
