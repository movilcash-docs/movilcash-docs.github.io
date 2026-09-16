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

/**
 * Picks the log file to read/write for a page. Defensively handles the (rare) case where Drive
 * ended up with more than one file of the same name — e.g. two tabs racing to create it at the
 * same instant, since Drive doesn't enforce unique names within a folder — by keeping the most
 * recently modified one, so a stray duplicate can't quietly hide already-recorded visits.
 */
function pickLogFile<T extends { name: string; modifiedTime: string }>(children: T[], pageId: string): T | undefined {
  const matches = children.filter((f) => f.name === viewLogFileName(pageId))
  if (matches.length <= 1) return matches[0]
  return matches.sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime))[0]
}

/** Reads a page's view log without recording a new visit — used just to display it. */
export async function getPageViews(rootFolderId: string, pageId: string, accessToken: string): Promise<PageView[]> {
  const viewsFolderId = await getOrCreateViewsFolder(rootFolderId, accessToken)
  const children = await listChildren(viewsFolderId, accessToken)
  const file = pickLogFile(children, pageId)
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
 * Records that `viewer` just opened `pageId`, and returns the updated view list. If `viewer`
 * already has an entry, nothing is written — re-visiting a page you already viewed doesn't need
 * to bump the timestamp, and skipping the write also shrinks the window for the read-modify-write
 * race described below.
 *
 * This is a read-modify-write on a small per-page file — two people opening the *same* page for
 * the *first* time at the exact same instant could race and one visit gets lost, but that's an
 * acceptable trade-off for a lightweight "seen by" feature without a real backend, and scoping the
 * file per page (not one shared file for the whole wiki) keeps the collision window as narrow as
 * it can be.
 */
export async function recordPageView(
  rootFolderId: string,
  pageId: string,
  viewer: { email: string; name?: string },
  accessToken: string,
): Promise<PageView[]> {
  const viewsFolderId = await getOrCreateViewsFolder(rootFolderId, accessToken)
  const children = await listChildren(viewsFolderId, accessToken)
  const existingFile = pickLogFile(children, pageId)

  let views: PageView[] = []
  if (existingFile) {
    try {
      const raw = await getFileText(existingFile.id, accessToken)
      views = (JSON.parse(raw) as { views?: PageView[] }).views ?? []
    } catch {
      views = []
    }
  }

  if (views.some((v) => v.email === viewer.email)) return views

  views.push({ ...viewer, viewedAt: new Date().toISOString() })

  const content = JSON.stringify({ views })
  if (existingFile) {
    await updateFileContent(existingFile.id, content, accessToken, 'application/json')
  } else {
    await createFile(viewsFolderId, viewLogFileName(pageId), content, 'application/json', accessToken)
  }

  return views
}
