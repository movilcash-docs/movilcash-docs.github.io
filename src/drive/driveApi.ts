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
