import { FOLDER_MIME_TYPE, listChildren, type DriveFile } from './driveApi'

export interface WikiPage {
  type: 'page'
  id: string
  /** File name including the .md extension. */
  name: string
  /** File name without the .md extension, used for routing. */
  slug: string
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
  sections: WikiSection[]
  /** Non-.md, non-folder files in this section (images, etc.), for resolving relative links. */
  assets: WikiAsset[]
}

const INDEX_FILE_NAME = 'index.md'

function toPage(file: DriveFile): WikiPage {
  return {
    type: 'page',
    id: file.id,
    name: file.name,
    slug: file.name.replace(/\.md$/i, ''),
    modifiedTime: file.modifiedTime,
  }
}

export async function buildWikiTree(
  folderId: string,
  folderName: string,
  accessToken: string,
): Promise<WikiSection> {
  const children = await listChildren(folderId, accessToken)

  const folders = children.filter((f) => f.mimeType === FOLDER_MIME_TYPE)
  const mdFiles = children.filter((f) => f.mimeType !== FOLDER_MIME_TYPE && /\.md$/i.test(f.name))
  const otherFiles = children.filter((f) => f.mimeType !== FOLDER_MIME_TYPE && !/\.md$/i.test(f.name))

  const indexFile = mdFiles.find((f) => f.name.toLowerCase() === INDEX_FILE_NAME)
  const pages = mdFiles.filter((f) => f !== indexFile).map(toPage)

  const sections = await Promise.all(
    folders.map((folder) => buildWikiTree(folder.id, folder.name, accessToken)),
  )

  return {
    type: 'section',
    id: folderId,
    name: folderName,
    indexPage: indexFile ? toPage(indexFile) : null,
    pages,
    sections,
    assets: otherFiles.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime })),
  }
}
