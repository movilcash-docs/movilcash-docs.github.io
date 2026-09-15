import { loadScript } from '../lib/loadScript'

const GAPI_SCRIPT_URL = 'https://apis.google.com/js/api.js'

let pickerApiLoaded: Promise<void> | undefined

async function ensurePickerApi(): Promise<void> {
  if (pickerApiLoaded) return pickerApiLoaded

  pickerApiLoaded = loadScript(GAPI_SCRIPT_URL).then(
    () =>
      new Promise<void>((resolve, reject) => {
        if (!window.gapi) {
          reject(new Error('gapi failed to load'))
          return
        }
        window.gapi.load('picker', () => resolve())
      }),
  )
  return pickerApiLoaded
}

export interface PickedFolder {
  id: string
  name: string
}

/** Opens the Google Picker restricted to folder selection; resolves to null if the user cancels. */
export async function pickFolder(accessToken: string): Promise<PickedFolder | null> {
  await ensurePickerApi()

  const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(true)
    .setMimeTypes('application/vnd.google-apps.folder')

  return new Promise((resolve) => {
    const builder = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setTitle('Elegí la carpeta raíz de la wiki')
      .setCallback((response) => {
        if (response.action === google.picker.Action.PICKED) {
          const doc = response.docs[0]
          resolve({ id: doc.id, name: doc.name })
        } else if (response.action === google.picker.Action.CANCEL) {
          resolve(null)
        }
      })

    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY
    if (apiKey) builder.setDeveloperKey(apiKey)

    builder.build().setVisible(true)
  })
}
