import { MoreHorizontal, Share2, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './auth/AuthContext'
import { setPageContent } from './cache/pageCache'
import { TopBar } from './components/TopBar'
import { PromptDialog } from './components/PromptDialog'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from 'cn'
import { createFile, createFolder, trashFile, updateFileContent } from './drive/driveApi'
import { findSectionForPage } from './drive/findSection'
import { flattenPages } from './drive/flattenPages'
import { MarkdownView } from './drive/MarkdownView'
import { PageEditor } from './drive/PageEditor'
import { pickFolder } from './drive/pickFolder'
import { useFavorites } from './drive/useFavorites'
import { useRootFolder } from './drive/RootFolderContext'
import { usePageContent } from './drive/usePageContent'
import { useWikiTree } from './drive/useWikiTree'
import { VersionHistoryDialog } from './drive/VersionHistoryDialog'
import { buildPathIndex } from './drive/wikiPathIndex'
import { WikiTreeView } from './drive/WikiTreeView'
import type { WikiPage, WikiSection } from './drive/wikiTree'

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
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <p>Cargando…</p>
      </main>
    )
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-3xl font-semibold">MovilCash Docs</h1>
        <p>Iniciá sesión con tu cuenta de Google para acceder a la wiki.</p>
        {error && <p className="text-destructive">{error}</p>}
        <Button onClick={signIn}>Iniciar sesión con Google</Button>
      </main>
    )
  }

  if (!rootFolder) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold">Elegí la carpeta de la wiki</h1>
        <p>Seleccioná la carpeta de Google Drive que contiene la wiki (ej. "wiki/").</p>
        {pickerError && <p className="text-destructive">{pickerError}</p>}
        <Button onClick={handlePickFolder}>Elegir carpeta</Button>
        <Button variant="outline" onClick={signOut}>
          Cerrar sesión
        </Button>
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
  const [isEditing, setIsEditing] = useState(false)
  const [activeSectionId, setActiveSectionId] = useState(rootFolderId)
  const [createPageOpen, setCreatePageOpen] = useState(false)
  const [createSectionOpen, setCreateSectionOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WikiPage | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites(rootFolderId)
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

  // Landing view: restore a shared "#page=<id>" deep link if present, otherwise show the root
  // section's index.md automatically (same as visiting "/" would).
  useEffect(() => {
    if (!tree || !pathIndex || selectedPage) return
    const hashMatch = window.location.hash.match(/^#page=(.+)$/)
    const linkedPage = hashMatch
      ? [...pathIndex.pages.values()].find((p) => p.id === decodeURIComponent(hashMatch[1]))
      : undefined
    setSelectedPage(linkedPage ?? tree.indexPage ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, pathIndex])

  // Keep the URL's hash pointing at whatever page is open, so "Compartir" has a real link to copy.
  useEffect(() => {
    if (!selectedPage) return
    const newHash = `#page=${encodeURIComponent(selectedPage.id)}`
    if (window.location.hash !== newHash) window.history.replaceState(null, '', newHash)
  }, [selectedPage])

  // "Where do new pages/sections go" follows whatever section the user is currently looking at.
  useEffect(() => {
    if (currentSection) setActiveSectionId(currentSection.section.id)
  }, [currentSection])

  function selectPage(page: WikiPage | null) {
    setSelectedPage(page)
    setIsEditing(false)
  }

  function selectSection(section: WikiSection) {
    setSelectedPage(null)
    setIsEditing(false)
    setActiveSectionId(section.id)
  }

  async function handleSavePage(newContent: string) {
    if (!accessToken || !selectedPage) return
    const updated = await updateFileContent(selectedPage.id, newContent, accessToken)
    await setPageContent(selectedPage.id, newContent, updated.modifiedTime)
    setSelectedPage({ ...selectedPage, modifiedTime: updated.modifiedTime })
    setIsEditing(false)
    refresh()
  }

  async function handleCreatePage(name: string) {
    if (!accessToken) return
    const fileName = name.toLowerCase().endsWith('.md') ? name : `${name}.md`
    try {
      const created = await createFile(activeSectionId, fileName, `# ${name}\n`, 'text/markdown', accessToken)
      refresh()
      selectPage({
        type: 'page',
        id: created.id,
        name: created.name,
        slug: created.name.replace(/\.md$/i, ''),
        modifiedTime: created.modifiedTime,
      })
      setIsEditing(true)
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  async function handleDuplicatePage(name: string) {
    if (!accessToken || !selectedPage || content === null) return
    const fileName = name.toLowerCase().endsWith('.md') ? name : `${name}.md`
    const targetSectionId = currentSection?.section.id ?? activeSectionId
    try {
      const created = await createFile(targetSectionId, fileName, content, 'text/markdown', accessToken)
      refresh()
      selectPage({
        type: 'page',
        id: created.id,
        name: created.name,
        slug: created.name.replace(/\.md$/i, ''),
        modifiedTime: created.modifiedTime,
      })
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  async function handleShare() {
    if (!selectedPage) return
    const url = `${window.location.origin}${window.location.pathname}#page=${encodeURIComponent(selectedPage.id)}`
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      window.prompt('Copiá el link:', url)
    }
  }

  async function handleCreateSection(name: string) {
    if (!accessToken) return
    try {
      await createFolder(activeSectionId, name, accessToken)
      refresh()
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  async function handleConfirmDelete() {
    if (!accessToken || !deleteTarget) return
    try {
      await trashFile(deleteTarget.id, accessToken)
      if (selectedPage?.id === deleteTarget.id) selectPage(null)
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  const topBar = (
    <TopBar
      tree={tree}
      onSelectPage={selectPage}
      accountLabel={accountLabel}
      onRefresh={refresh}
      onChangeFolder={onChangeFolder}
      onSignOut={onSignOut}
    />
  )

  if (isLoading) {
    return (
      <div className="flex min-h-svh flex-col">
        {topBar}
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p>Leyendo la estructura de "{rootFolderName}"…</p>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-svh flex-col">
        {topBar}
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-destructive">Error leyendo Drive: {error}</p>
          <div className="flex gap-3">
            <Button onClick={refresh}>Reintentar</Button>
            <Button variant="outline" onClick={onChangeFolder}>
              Cambiar carpeta
            </Button>
          </div>
        </main>
      </div>
    )
  }

  if (!tree) return null

  return (
    <div className="flex min-h-svh flex-col">
      <div className="print:hidden">{topBar}</div>
      <div className="flex min-h-0 flex-1">
        <aside className="w-70 shrink-0 border-r p-4 print:hidden">
          <div className="mb-4">
            <strong>{rootFolderName}</strong>
          </div>
          <ScrollArea className="h-[calc(100svh-7rem)]">
            {favoriteIds.size > 0 && (
              <div className="mb-4">
                <div className="text-muted-foreground mb-1 px-1.5 text-xs font-semibold uppercase">Favoritos</div>
                <div className="flex flex-col gap-0.5">
                  {flattenPages(tree)
                    .filter((fp) => favoriteIds.has(fp.page.id))
                    .map((fp) => (
                      <Button
                        key={fp.page.id}
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'justify-start gap-1.5 truncate',
                          fp.page.id === selectedPage?.id && 'bg-muted font-semibold',
                        )}
                        onClick={() => selectPage(fp.page)}
                      >
                        <Star className="size-3.5 shrink-0 fill-current text-yellow-500" />
                        {fp.page.slug}
                      </Button>
                    ))}
                </div>
              </div>
            )}
            <WikiTreeView
              section={tree}
              selectedPageId={selectedPage?.id ?? null}
              onSelectPage={selectPage}
              onSelectSection={selectSection}
              onCreatePage={(s) => {
                setActiveSectionId(s.id)
                setCreatePageOpen(true)
              }}
              onCreateSection={(s) => {
                setActiveSectionId(s.id)
                setCreateSectionOpen(true)
              }}
            />
          </ScrollArea>
        </aside>
        <section className="flex-1 overflow-y-auto p-8">
          {!selectedPage && !tree.indexPage && (
            <p>
              No hay <code>index.md</code> en la raíz de "{rootFolderName}" — creá uno en Drive para que sea la
              portada de la wiki, o elegí una página del árbol de la izquierda.
            </p>
          )}
          {!selectedPage && tree.indexPage && <p>Elegí una página del árbol de la izquierda.</p>}
          {selectedPage && isPageLoading && <p>Cargando página…</p>}
          {selectedPage && pageError && (
            <p className="text-destructive">
              {pageErrorReason === 'fileNotDownloadable'
                ? `"${selectedPage.name}" es un Google Doc/Sheet nativo, no un archivo de texto. Para que la wiki lo pueda leer, subí o creá un archivo de texto plano (.md) en Drive en su lugar.`
                : `Error: ${pageError}`}
            </p>
          )}
          {selectedPage && content !== null && accessToken && pathIndex && !isEditing && (
            <article className="prose dark:prose-invert mx-auto max-w-3xl">
              <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
                <div className="text-muted-foreground min-w-0 truncate text-sm">
                  {rootFolderName}
                  {currentSection && currentSection.path.length > 0 && ` / ${currentSection.path.join(' / ')}`}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={isFavorite(selectedPage.id) ? 'Quitar de favoritos' : 'Marcar como favorito'}
                    onClick={() => toggleFavorite(selectedPage.id)}
                  >
                    <Star className={cn('size-4', isFavorite(selectedPage.id) && 'fill-yellow-500 text-yellow-500')} />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleShare}>
                    <Share2 />
                    {shareCopied ? 'Copiado' : 'Compartir'}
                  </Button>
                  <Button size="sm" onClick={() => setIsEditing(true)}>
                    Editar
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" aria-label="Más opciones">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>Historial</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setDuplicateOpen(true)}>Hacer una copia</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => window.print()}>Descargar PDF</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(selectedPage)}>
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <MarkdownView
                content={content}
                assets={currentSection?.section.assets ?? []}
                basePath={currentSection?.path ?? []}
                pathIndex={pathIndex}
                accessToken={accessToken}
                onSelectPage={selectPage}
              />
            </article>
          )}
          {selectedPage && content !== null && accessToken && pathIndex && isEditing && (
            <PageEditor
              key={selectedPage.id}
              initialContent={content}
              sectionId={currentSection?.section.id ?? activeSectionId}
              assets={currentSection?.section.assets ?? []}
              basePath={currentSection?.path ?? []}
              pathIndex={pathIndex}
              accessToken={accessToken}
              onSave={handleSavePage}
              onCancel={() => setIsEditing(false)}
            />
          )}
        </section>
      </div>

      {selectedPage && accessToken && (
        <VersionHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          page={selectedPage}
          accessToken={accessToken}
          onRestore={handleSavePage}
        />
      )}

      <PromptDialog
        open={createPageOpen}
        onOpenChange={setCreatePageOpen}
        title="Nueva página"
        label="Nombre de la página (sin .md)"
        placeholder="ej. guia-de-despliegue"
        onConfirm={handleCreatePage}
      />
      {selectedPage && (
        <PromptDialog
          open={duplicateOpen}
          onOpenChange={setDuplicateOpen}
          title="Hacer una copia"
          label="Nombre de la copia (sin .md)"
          defaultValue={`${selectedPage.slug} copia`}
          confirmLabel="Duplicar"
          onConfirm={handleDuplicatePage}
        />
      )}
      <PromptDialog
        open={createSectionOpen}
        onOpenChange={setCreateSectionOpen}
        title="Nueva sección"
        label="Nombre de la sección (carpeta)"
        placeholder="ej. infraestructura"
        onConfirm={handleCreateSection}
      />
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deleteTarget?.slug}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Queda recuperable desde la papelera de Google Drive, no se borra para siempre.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default App
