const FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files'
export const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
}

export class DriveApiError extends Error {
  status: number
  /** Drive's machine-readable error reason (e.g. "fileNotDownloadable"), when available. */
  reason?: string

  constructor(message: string, status: number, reason?: string) {
    super(message)
    this.name = 'DriveApiError'
    this.status = status
    this.reason = reason
  }
}

async function driveFetch(url: string, accessToken: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    let message = `Drive API error ${response.status}`
    let reason: string | undefined
    try {
      const body = (await response.json()) as { error?: { message?: string; errors?: { reason?: string }[] } }
      if (body.error?.message) message = body.error.message
      reason = body.error?.errors?.[0]?.reason
    } catch {
      // Body wasn't JSON — keep the generic message.
    }
    throw new DriveApiError(message, response.status, reason)
  }
  return response
}

/** Lists the direct children (folders and files) of a Drive folder. */
export async function listChildren(folderId: string, accessToken: string): Promise<DriveFile[]> {
  const children: DriveFile[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime)',
      pageSize: '1000',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const response = await driveFetch(`${FILES_ENDPOINT}?${params.toString()}`, accessToken)
    const data = (await response.json()) as { files: DriveFile[]; nextPageToken?: string }
    children.push(...data.files)
    pageToken = data.nextPageToken
  } while (pageToken)

  return children
}

/** Fetches a file's raw bytes (used for both markdown text and image assets). */
export async function getFileContent(fileId: string, accessToken: string): Promise<Blob> {
  const response = await driveFetch(`${FILES_ENDPOINT}/${fileId}?alt=media`, accessToken)
  return response.blob()
}

export async function getFileText(fileId: string, accessToken: string): Promise<string> {
  const blob = await getFileContent(fileId, accessToken)
  return blob.text()
}

const UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files'
const FILE_FIELDS = 'id,name,mimeType,modifiedTime'

function buildMultipartBody(boundary: string, metadata: object, content: BlobPart, contentType: string): Blob {
  return new Blob([
    `--${boundary}\r\n`,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\n`,
    `Content-Type: ${contentType}\r\n\r\n`,
    content,
    `\r\n--${boundary}--`,
  ])
}

/** Creates a new file (a .md page or an image asset) with its content, in one request. */
export async function createFile(
  parentId: string,
  name: string,
  content: BlobPart,
  contentType: string,
  accessToken: string,
): Promise<DriveFile> {
  const boundary = `wiki-${Math.random().toString(36).slice(2)}`
  const body = buildMultipartBody(boundary, { name, parents: [parentId] }, content, contentType)

  const response = await driveFetch(
    `${UPLOAD_ENDPOINT}?uploadType=multipart&fields=${FILE_FIELDS}`,
    accessToken,
    { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body },
  )
  return response.json()
}

export async function createFolder(parentId: string, name: string, accessToken: string): Promise<DriveFile> {
  const response = await driveFetch(`${FILES_ENDPOINT}?fields=${FILE_FIELDS}`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parents: [parentId], mimeType: FOLDER_MIME_TYPE }),
  })
  return response.json()
}

/** Replaces a page's markdown text, leaving its name/location untouched. */
export async function updateFileContent(fileId: string, content: string, accessToken: string): Promise<DriveFile> {
  const response = await driveFetch(
    `${UPLOAD_ENDPOINT}/${fileId}?uploadType=media&fields=${FILE_FIELDS}`,
    accessToken,
    { method: 'PATCH', headers: { 'Content-Type': 'text/markdown' }, body: content },
  )
  return response.json()
}

/** Moves a file/folder to Drive's trash (recoverable), rather than a permanent delete. */
export async function trashFile(fileId: string, accessToken: string): Promise<void> {
  await driveFetch(`${FILES_ENDPOINT}/${fileId}`, accessToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  })
}
