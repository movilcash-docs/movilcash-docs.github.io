import { useState } from 'react'
import { useAuth } from './auth/AuthContext'
import { pickFolder } from './drive/pickFolder'
import { useRootFolder } from './drive/RootFolderContext'
import './App.css'

function App() {
  const { isAuthenticated, isLoading, error, signIn, signOut, accessToken } = useAuth()
  const { rootFolder, setRootFolder, clearRootFolder } = useRootFolder()
  const [pickerError, setPickerError] = useState<string | null>(null)

  async function handlePickFolder() {
    if (!accessToken) return
    setPickerError(null)
    try {
      const folder = await pickFolder(accessToken)
      if (folder) setRootFolder(folder)
    } catch (err) {
      setPickerError((err as Error).message)
    }
  }

  if (isLoading) {
    return (
      <main className="status-screen">
        <p>Cargando…</p>
      </main>
    )
  }

  if (!isAuthenticated) {
    return (
      <main className="status-screen">
        <h1>MovilCash Docs</h1>
        <p>Iniciá sesión con tu cuenta de Google para acceder a la wiki.</p>
        {error && <p className="error">{error}</p>}
        <button type="button" onClick={signIn}>
          Iniciar sesión con Google
        </button>
      </main>
    )
  }

  if (!rootFolder) {
    return (
      <main className="status-screen">
        <h1>Elegí la carpeta de la wiki</h1>
        <p>Seleccioná la carpeta de Google Drive que contiene la wiki (ej. "wiki/").</p>
        {pickerError && <p className="error">{pickerError}</p>}
        <button type="button" onClick={handlePickFolder}>
          Elegir carpeta
        </button>
        <button type="button" className="secondary" onClick={signOut}>
          Cerrar sesión
        </button>
      </main>
    )
  }

  return (
    <main className="status-screen">
      <h1>{rootFolder.name}</h1>
      <p>Sesión iniciada. Próximo paso: leer la estructura de esta carpeta desde Drive (Fase 2).</p>
      <div className="actions">
        <button type="button" onClick={clearRootFolder}>
          Cambiar carpeta
        </button>
        <button type="button" className="secondary" onClick={signOut}>
          Cerrar sesión
        </button>
      </div>
    </main>
  )
}

export default App
