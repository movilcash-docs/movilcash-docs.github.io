import { getFileText } from '../drive/driveApi'
import { getDb } from './db'

/** Returns a page's markdown text, skipping the network call if the cached copy's modifiedTime matches. */
export async function getPageContent(fileId: string, modifiedTime: string, accessToken: string): Promise<string> {
  const db = await getDb()
  const cached = await db.get('pages', fileId)
  if (cached && cached.modifiedTime === modifiedTime) {
    return cached.content
  }

  const content = await getFileText(fileId, accessToken)
  await db.put('pages', { fileId, content, modifiedTime })
  return content
}

/** Writes a freshly-saved page straight into the cache, avoiding a redundant re-download. */
export async function setPageContent(fileId: string, content: string, modifiedTime: string): Promise<void> {
  const db = await getDb()
  await db.put('pages', { fileId, content, modifiedTime })
}
