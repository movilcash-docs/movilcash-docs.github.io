import { createFile, createFolder, FOLDER_MIME_TYPE, getFileText, listChildren, updateFileContent } from './driveApi'

/** Internal folder (hidden from the wiki tree, see wikiTree.ts) holding one small JSON file per page. */
const VIEWS_FOLDER_NAME = '.mc-docs-views'

export interface PageView {
  email: string
  name?: string
  /** ISO timestamp of this viewer's most recent visit. */
  viewedAt: string
}

let viewsFolderIdCache: string | null = null

async function getOrCreateViewsFolder(rootFolderId: string, accessToken: string): Promise<string> {
  if (viewsFolderIdCache) return viewsFolderIdCache

  const children = await listChildren(rootFolderId, accessToken)
  const existing = children.find((f) => f.mimeType === FOLDER_MIME_TYPE && f.name === VIEWS_FOLDER_NAME)
  const folderId = existing ? existing.id : (await createFolder(rootFolderId, VIEWS_FOLDER_NAME, accessToken)).id
  viewsFolderIdCache = folderId
  return folderId
}

function viewLogFileName(pageId: string): string {
  return `${pageId}.json`
}

/** Reads a page's view log without recording a new visit — used just to display it. */
export async function getPageViews(rootFolderId: string, pageId: string, accessToken: string): Promise<PageView[]> {
  const viewsFolderId = await getOrCreateViewsFolder(rootFolderId, accessToken)
  const children = await listChildren(viewsFolderId, accessToken)
  const file = children.find((f) => f.name === viewLogFileName(pageId))
  if (!file) return []

  try {
    const raw = await getFileText(file.id, accessToken)
    const parsed = JSON.parse(raw) as { views?: PageView[] }
    return parsed.views ?? []
  } catch {
    return []
  }
}

/**
 * Records that `viewer` just opened `pageId`, and returns the updated view list.
 *
 * This is a read-modify-write on a small per-page file — two people opening the *same* page at
 * the exact same instant could race and one visit gets lost, but that's an acceptable trade-off
 * for a lightweight "seen by" feature without a real backend, and scoping the file per page (not
 * one shared file for the whole wiki) keeps the collision window as narrow as it can be.
 */
export async function recordPageView(
  rootFolderId: string,
  pageId: string,
  viewer: { email: string; name?: string },
  accessToken: string,
): Promise<PageView[]> {
  const viewsFolderId = await getOrCreateViewsFolder(rootFolderId, accessToken)
  const children = await listChildren(viewsFolderId, accessToken)
  const existingFile = children.find((f) => f.name === viewLogFileName(pageId))

  let views: PageView[] = []
  if (existingFile) {
    try {
      const raw = await getFileText(existingFile.id, accessToken)
      views = (JSON.parse(raw) as { views?: PageView[] }).views ?? []
    } catch {
      views = []
    }
  }

  const viewedAt = new Date().toISOString()
  const idx = views.findIndex((v) => v.email === viewer.email)
  if (idx >= 0) views[idx] = { ...viewer, viewedAt }
  else views.push({ ...viewer, viewedAt })

  const content = JSON.stringify({ views })
  if (existingFile) {
    await updateFileContent(existingFile.id, content, accessToken, 'application/json')
  } else {
    await createFile(viewsFolderId, viewLogFileName(pageId), content, 'application/json', accessToken)
  }

  return views
}
