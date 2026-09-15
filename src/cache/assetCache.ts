import { getFileContent } from '../drive/driveApi'
import { getDb } from './db'

/**
 * Returns an asset's bytes as a Blob, skipping the network call if the cached
 * copy's modifiedTime matches. Used to resolve private Drive images referenced
 * from markdown (see Fase 4: the blob is turned into an object URL for <img>).
 */
export async function getAssetBlob(fileId: string, modifiedTime: string, accessToken: string): Promise<Blob> {
  const db = await getDb()
  const cached = await db.get('assets', fileId)
  if (cached && cached.modifiedTime === modifiedTime) {
    return cached.blob
  }

  const blob = await getFileContent(fileId, accessToken)
  await db.put('assets', { fileId, blob, modifiedTime })
  return blob
}
