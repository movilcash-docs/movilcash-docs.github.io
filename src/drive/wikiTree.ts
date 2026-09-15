import { FOLDER_MIME_TYPE, listChildren, type DriveFile } from './driveApi'

const GOOGLE_DOC_MIME_TYPE = 'application/vnd.google-apps.document'
const GOOGLE_SHEET_MIME_TYPE = 'application/vnd.google-apps.spreadsheet'
const PDF_MIME_TYPE = 'application/pdf'

export interface WikiPage {
  type: 'page'
  id: string
  /** File name including the .md extension. */
  name: string
  /** File name without the .md extension, used for routing. */
  slug: string
  modifiedTime: string
}

export interface WikiNotebook {
  type: 'notebook'
  id: string
  /** File name including the .ipynb extension. */
  name: string
  /** File name without the .ipynb extension. */
  slug: string
  modifiedTime: string
}

export interface WikiPdf {
  type: 'pdf'
  id: string
  name: string
  modifiedTime: string
}

export interface WikiGoogleFile {
  type: 'gdoc' | 'gsheet'
  id: string
  name: string
  modifiedTime: string
}

export interface WikiAsset {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
}

export interface WikiSection {
  type: 'section'
  id: string
  name: string
  /** The section's index.md, if present — rendered when navigating to the section itself. */
  indexPage: WikiPage | null
  pages: WikiPage[]
  notebooks: WikiNotebook[]
  pdfs: WikiPdf[]
  googleFiles: WikiGoogleFile[]
  sections: WikiSection[]
  /** Everything else in this section (images, etc.), for resolving relative links from markdown. */
  assets: WikiAsset[]
}

/** A tree item being renamed, moved, or deleted from the sidebar — enough info for the UI + API calls. */
export interface TreeItemRef {
  kind: 'section' | 'page' | 'notebook' | 'pdf' | 'gdoc' | 'gsheet'
  id: string
  /** Extension-less for pages/notebooks (so the rename prompt doesn't make you retype ".md"), full name otherwise. */
  label: string
}

const INDEX_FILE_NAME = 'index.md'

function sortByName<T>(items: T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => key(a).localeCompare(key(b), undefined, { numeric: true, sensitivity: 'base' }))
}

function toPage(file: DriveFile): WikiPage {
  return {
    type: 'page',
    id: file.id,
    name: file.name,
    slug: file.name.replace(/\.md$/i, ''),
    modifiedTime: file.modifiedTime,
  }
}

function toNotebook(file: DriveFile): WikiNotebook {
  return {
    type: 'notebook',
    id: file.id,
    name: file.name,
    slug: file.name.replace(/\.ipynb$/i, ''),
    modifiedTime: file.modifiedTime,
  }
}

export async function buildWikiTree(
  folderId: string,
  folderName: string,
  accessToken: string,
): Promise<WikiSection> {
  const children = await listChildren(folderId, accessToken)

  const folders = sortByName(
    children.filter((f) => f.mimeType === FOLDER_MIME_TYPE),
    (f) => f.name,
  )
  const mdFiles = children.filter((f) => f.mimeType !== FOLDER_MIME_TYPE && /\.md$/i.test(f.name))
  const notebookFiles = children.filter((f) => f.mimeType !== FOLDER_MIME_TYPE && /\.ipynb$/i.test(f.name))
  const pdfFiles = children.filter((f) => f.mimeType === PDF_MIME_TYPE)
  const googleDocFiles = children.filter((f) => f.mimeType === GOOGLE_DOC_MIME_TYPE)
  const googleSheetFiles = children.filter((f) => f.mimeType === GOOGLE_SHEET_MIME_TYPE)
  const classified = new Set([...mdFiles, ...notebookFiles, ...pdfFiles, ...googleDocFiles, ...googleSheetFiles])
  const otherFiles = children.filter((f) => f.mimeType !== FOLDER_MIME_TYPE && !classified.has(f))

  const indexFile = mdFiles.find((f) => f.name.toLowerCase() === INDEX_FILE_NAME)
  const pages = sortByName(mdFiles.filter((f) => f !== indexFile).map(toPage), (p) => p.slug)
  const notebooks = sortByName(notebookFiles.map(toNotebook), (n) => n.slug)
  const pdfs = sortByName(
    pdfFiles.map((f) => ({ type: 'pdf' as const, id: f.id, name: f.name, modifiedTime: f.modifiedTime })),
    (p) => p.name,
  )
  const googleFiles = sortByName(
    [
      ...googleDocFiles.map((f) => ({ type: 'gdoc' as const, id: f.id, name: f.name, modifiedTime: f.modifiedTime })),
      ...googleSheetFiles.map((f) => ({ type: 'gsheet' as const, id: f.id, name: f.name, modifiedTime: f.modifiedTime })),
    ],
    (f) => f.name,
  )

  const sections = await Promise.all(
    folders.map((folder) => buildWikiTree(folder.id, folder.name, accessToken)),
  )

  return {
    type: 'section',
    id: folderId,
    name: folderName,
    indexPage: indexFile ? toPage(indexFile) : null,
    pages,
    notebooks,
    pdfs,
    googleFiles,
    sections,
    assets: otherFiles.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime })),
  }
}
