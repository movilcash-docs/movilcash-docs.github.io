import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './auth/AuthContext'
import { TopBar } from './components/TopBar'
import { findSectionForPage } from './drive/findSection'
import { MarkdownView } from './drive/MarkdownView'
import { pickFolder } from './drive/pickFolder'
import { useRootFolder } from './drive/RootFolderContext'
import { usePageContent } from './drive/usePageContent'
import { useWikiTree } from './drive/useWikiTree'
import { buildPathIndex } from './drive/wikiPathIndex'
import { WikiTreeView } from './drive/WikiTreeView'
import type { WikiPage } from './drive/wikiTree'
import './App.css'

function App() {
  const { isAuthenticated, isLoading, error, signIn, signOut, accessToken, user } = useAuth()
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
    <WikiExplorer
      accessToken={accessToken}
      rootFolderId={rootFolder.id}
      rootFolderName={rootFolder.name}
      accountLabel={user?.name ?? user?.email ?? ''}
      onChangeFolder={clearRootFolder}
      onSignOut={signOut}
    />
  )
}

interface WikiExplorerProps {
  accessToken: string | null
  rootFolderId: string
  rootFolderName: string
  accountLabel: string
  onChangeFolder: () => void
  onSignOut: () => void
}

function WikiExplorer({
  accessToken,
  rootFolderId,
  rootFolderName,
  accountLabel,
  onChangeFolder,
  onSignOut,
}: WikiExplorerProps) {
  const { tree, isLoading, error, refresh } = useWikiTree(accessToken, rootFolderId, rootFolderName)
  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null)
  const {
    content,
    isLoading: isPageLoading,
    error: pageError,
    errorReason: pageErrorReason,
  } = usePageContent(accessToken, selectedPage)
  const currentSection = useMemo(
    () => (tree && selectedPage ? findSectionForPage(tree, selectedPage.id) : null),
    [tree, selectedPage],
  )
  const pathIndex = useMemo(() => (tree ? buildPathIndex(tree) : null), [tree])

  // Landing view: show the root section's index.md automatically, same as visiting "/" would.
  useEffect(() => {
    if (tree?.indexPage && !selectedPage) setSelectedPage(tree.indexPage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree])

  const topBar = (
    <TopBar
      tree={tree}
      onSelectPage={setSelectedPage}
      accountLabel={accountLabel}
      onRefresh={refresh}
      onChangeFolder={onChangeFolder}
      onSignOut={onSignOut}
    />
  )

  if (isLoading) {
    return (
      <div className="app-shell">
        {topBar}
        <main className="status-screen">
          <p>Leyendo la estructura de "{rootFolderName}"…</p>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-shell">
        {topBar}
        <main className="status-screen">
          <p className="error">Error leyendo Drive: {error}</p>
          <div className="actions">
            <button type="button" onClick={refresh}>
              Reintentar
            </button>
            <button type="button" className="secondary" onClick={onChangeFolder}>
              Cambiar carpeta
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (!tree) return null

  return (
    <div className="app-shell">
      {topBar}
      <div className="wiki-layout">
        <aside className="wiki-sidebar">
          <div className="wiki-sidebar-header">
            <strong>{rootFolderName}</strong>
          </div>
          <WikiTreeView section={tree} selectedPageId={selectedPage?.id ?? null} onSelectPage={setSelectedPage} />
        </aside>
        <section className="wiki-content">
        {!selectedPage && !tree.indexPage && (
          <p>
            No hay <code>index.md</code> en la raíz de "{rootFolderName}" — creá uno en Drive para que sea la
            portada de la wiki, o elegí una página del árbol de la izquierda.
          </p>
        )}
        {!selectedPage && tree.indexPage && <p>Elegí una página del árbol de la izquierda.</p>}
        {selectedPage && isPageLoading && <p>Cargando página…</p>}
        {selectedPage && pageError && (
          <p className="error">
            {pageErrorReason === 'fileNotDownloadable'
              ? `"${selectedPage.name}" es un Google Doc/Sheet nativo, no un archivo de texto. Para que la wiki lo pueda leer, subí o creá un archivo de texto plano (.md) en Drive en su lugar.`
              : `Error: ${pageError}`}
          </p>
        )}
        {selectedPage && content !== null && accessToken && pathIndex && (
          <article className="page-article">
            <div className="page-toolbar">
              <button type="button" onClick={() => window.print()}>
                Descargar PDF
              </button>
            </div>
            <MarkdownView
              content={content}
              assets={currentSection?.section.assets ?? []}
              basePath={currentSection?.path ?? []}
              pathIndex={pathIndex}
              accessToken={accessToken}
              onSelectPage={setSelectedPage}
            />
          </article>
        )}
        </section>
      </div>
    </div>
  )
}

export default App
