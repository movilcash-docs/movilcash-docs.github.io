import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { PickedFolder } from './pickFolder'

const STORAGE_KEY = 'wiki.rootFolder'

interface RootFolderContextValue {
  rootFolder: PickedFolder | null
  setRootFolder: (folder: PickedFolder) => void
  clearRootFolder: () => void
}

const RootFolderContext = createContext<RootFolderContextValue | undefined>(undefined)

function readStoredFolder(): PickedFolder | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PickedFolder) : null
  } catch {
    return null
  }
}

export function RootFolderProvider({ children }: { children: ReactNode }) {
  const [rootFolder, setRootFolderState] = useState<PickedFolder | null>(readStoredFolder)

  const setRootFolder = useCallback((folder: PickedFolder) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(folder))
    setRootFolderState(folder)
  }, [])

  const clearRootFolder = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setRootFolderState(null)
  }, [])

  return (
    <RootFolderContext.Provider value={{ rootFolder, setRootFolder, clearRootFolder }}>
      {children}
    </RootFolderContext.Provider>
  )
}

export function useRootFolder(): RootFolderContextValue {
  const ctx = useContext(RootFolderContext)
  if (!ctx) throw new Error('useRootFolder must be used within a RootFolderProvider')
  return ctx
}
