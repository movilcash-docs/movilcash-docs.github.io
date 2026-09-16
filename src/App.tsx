import {
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Folder,
  Lock,
  LockOpen,
  MoreHorizontal,
  NotebookText,
  Pencil,
  Share2,
  Star,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import movilcashIcon from './assets/movilcash-icon.png'
import { useAuth } from './auth/AuthContext'
import { setPageContent } from './cache/pageCache'
import { TopBar } from './components/TopBar'
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog'
import { MoveConfirmDialog } from './components/MoveConfirmDialog'
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
import { Switch } from '@/components/ui/switch'
import { cn } from 'cn'
import {
  createFile,
  createFolder,
  moveFile,
  renameFile,
  setFileProperties,
  trashFile,
  updateFileContent,
} from './drive/driveApi'
import {
  findSectionById,
  findSectionForGoogleFile,
  findSectionForNotebook,
  findSectionForPage,
  findSectionForPdf,
  findSectionLocationById,
  sectionContains,
} from './drive/findSection'
import { flattenPages } from './drive/flattenPages'
import { MarkdownView } from './drive/MarkdownView'
import { NotebookView } from './drive/NotebookView'
import { PageByline } from './drive/PageByline'
import { SeenBy } from './drive/SeenBy'
import { PageEditor } from './drive/PageEditor'
import { PdfView } from './drive/PdfView'
import { pickFolder } from './drive/pickFolder'
import { useFavorites } from './drive/useFavorites'
import { useNotebookContent } from './drive/useNotebookContent'
import { usePageAuthorship } from './drive/usePageAuthorship'
import { usePageViewTracking } from './drive/usePageViewTracking'
import { useRootFolder } from './drive/RootFolderContext'
import { usePageContent } from './drive/usePageContent'
import { useWikiTree } from './drive/useWikiTree'
import { VersionHistoryDialog } from './drive/VersionHistoryDialog'
import { toggleTaskAtIndex } from './drive/markdownEditorCommands'
import { buildPathIndex } from './drive/wikiPathIndex'
import { WikiTreeView } from './drive/WikiTreeView'
import type { TreeItemRef, WikiGoogleFile, WikiNotebook, WikiPage, WikiPdf, WikiSection } from './drive/wikiTree'

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
        <img src={movilcashIcon} alt="" className="size-12" />
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
      viewer={user ? { email: user.email, name: user.name } : null}
      onChangeFolder={clearRootFolder}
      onSignOut={signOut}
    />
  )
}

/** Minimal shape the delete-confirmation dialog needs — any Drive file (page, PDF, etc.) qualifies. */
interface DeletableItem {
  id: string
  label: string
}

interface WikiExplorerProps {
  accessToken: string | null
  rootFolderId: string
  rootFolderName: string
  accountLabel: string
  viewer: { email: string; name?: string } | null
  onChangeFolder: () => void
  onSignOut: () => void
}

function WikiExplorer({
  accessToken,
  rootFolderId,
  rootFolderName,
  accountLabel,
  viewer,
  onChangeFolder,
  onSignOut,
}: WikiExplorerProps) {
  const { tree, isLoading, error, refresh } = useWikiTree(accessToken, rootFolderId, rootFolderName)
  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null)
  const [selectedNotebook, setSelectedNotebook] = useState<WikiNotebook | null>(null)
  const [selectedPdf, setSelectedPdf] = useState<WikiPdf | null>(null)
  const [selectedGoogleFile, setSelectedGoogleFile] = useState<WikiGoogleFile | null>(null)
  const [viewedSection, setViewedSection] = useState<WikiSection | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [activeSectionId, setActiveSectionId] = useState(rootFolderId)
  const [createPageOpen, setCreatePageOpen] = useState(false)
  const [createSectionOpen, setCreateSectionOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeletableItem | null>(null)
  const [sectionToDelete, setSectionToDelete] = useState<WikiSection | null>(null)
  const [renameTarget, setRenameTarget] = useState<TreeItemRef | null>(null)
  const [moveRequest, setMoveRequest] = useState<{
    item: TreeItemRef
    sourceParentId: string
    target: { id: string; name: string }
  } | null>(null)
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
  const [optimisticContent, setOptimisticContent] = useState<string | null>(null)
  const [editPermissionOverride, setEditPermissionOverride] = useState<boolean | null>(null)
  const pageAuthorship = usePageAuthorship(accessToken, selectedPage?.id ?? null)
  const pageViews = usePageViewTracking(accessToken, rootFolderId, selectedPage?.id ?? null, viewer)

  // Soft, convention-based gate — not real Drive-level access control (anyone with edit access to
  // the underlying file could still bypass this via Drive directly). Missing the property at all
  // (pages created before this feature, or never touched by the creator) defaults to "open", so we
  // don't silently lock out editors who could edit a moment ago.
  const isPageCreator =
    !!viewer && !!pageAuthorship && pageAuthorship.owners.some((o) => o.emailAddress === viewer.email)
  const editableByAnyone = editPermissionOverride ?? pageAuthorship?.properties?.editableByAnyone !== 'false'
  const canEditPage = !pageAuthorship || isPageCreator || editableByAnyone
  const {
    notebook,
    isLoading: isNotebookLoading,
    error: notebookError,
    errorReason: notebookErrorReason,
  } = useNotebookContent(accessToken, selectedNotebook)
  const currentSection = useMemo(
    () => (tree && selectedPage ? findSectionForPage(tree, selectedPage.id) : null),
    [tree, selectedPage],
  )
  const currentNotebookSection = useMemo(
    () => (tree && selectedNotebook ? findSectionForNotebook(tree, selectedNotebook.id) : null),
    [tree, selectedNotebook],
  )
  const currentPdfSection = useMemo(
    () => (tree && selectedPdf ? findSectionForPdf(tree, selectedPdf.id) : null),
    [tree, selectedPdf],
  )
  const currentGoogleFileSection = useMemo(
    () => (tree && selectedGoogleFile ? findSectionForGoogleFile(tree, selectedGoogleFile.id) : null),
    [tree, selectedGoogleFile],
  )
  const viewedSectionLocation = useMemo(
    () => (tree && viewedSection ? findSectionLocationById(tree, viewedSection.id) : null),
    [tree, viewedSection],
  )
  const pathIndex = useMemo(() => (tree ? buildPathIndex(tree) : null), [tree])
  // The page id from a shared "#page=<id>" link, if any — kept until found (see effect below),
  // since the first tree available can be an incomplete/stale IndexedDB cache that doesn't have
  // it yet, and the fresh one arrives moments later via the background refetch.
  const pendingHashPageId = useRef<string | null>(
    (() => {
      const m = window.location.hash.match(/^#page=(.+)$/)
      return m ? decodeURIComponent(m[1]) : null
    })(),
  )
  // True while the current selectedPage is just our own placeholder (the root index), not
  // something the user actually clicked — safe to replace once the real hash target shows up.
  const autoSelected = useRef(false)

  // Landing view: restore a shared "#page=<id>" deep link if present, otherwise show the root
  // section's index.md automatically (same as visiting "/" would). Re-checked on every tree
  // update (not just once) until the hash target is actually found, since the first tree paint
  // can come from an incomplete/stale cache — see the refs above.
  useEffect(() => {
    if (!tree || !pathIndex) return
    // Any of these means the user already navigated somewhere on their own — stop auto-restoring.
    if (selectedNotebook || selectedPdf || selectedGoogleFile || viewedSection) return
    if (selectedPage && !autoSelected.current) return

    if (pendingHashPageId.current) {
      const linkedPage = [...pathIndex.pages.values()].find((p) => p.id === pendingHashPageId.current)
      if (linkedPage) {
        setSelectedPage(linkedPage)
        autoSelected.current = false
        pendingHashPageId.current = null
        return
      }
    }
    if (!selectedPage || autoSelected.current) {
      setSelectedPage(tree.indexPage ?? null)
      autoSelected.current = true
    }
  }, [tree, pathIndex, selectedPage, selectedNotebook, selectedPdf, selectedGoogleFile, viewedSection])

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

  // Keep the section-overview listing in sync with a fresh tree (renames/moves/deletes inside it).
  useEffect(() => {
    if (!tree || !viewedSection) return
    const fresh = findSectionById(tree, viewedSection.id)
    if (fresh !== viewedSection) setViewedSection(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree])

  function selectPage(page: WikiPage | null) {
    autoSelected.current = false
    setSelectedPage(page)
    setSelectedNotebook(null)
    setSelectedPdf(null)
    setSelectedGoogleFile(null)
    setViewedSection(null)
    setIsEditing(false)
    setOptimisticContent(null)
    setEditPermissionOverride(null)
  }

  function selectNotebook(notebook: WikiNotebook) {
    setSelectedNotebook(notebook)
    setSelectedPage(null)
    setSelectedPdf(null)
    setSelectedGoogleFile(null)
    setViewedSection(null)
    setIsEditing(false)
  }

  function selectPdf(pdf: WikiPdf) {
    setSelectedPdf(pdf)
    setSelectedPage(null)
    setSelectedNotebook(null)
    setSelectedGoogleFile(null)
    setViewedSection(null)
    setIsEditing(false)
  }

  function selectGoogleFile(file: WikiGoogleFile) {
    setSelectedGoogleFile(file)
    setSelectedPage(null)
    setSelectedNotebook(null)
    setSelectedPdf(null)
    setViewedSection(null)
    setIsEditing(false)
  }

  function selectSection(section: WikiSection) {
    setSelectedPage(null)
    setSelectedNotebook(null)
    setSelectedPdf(null)
    setSelectedGoogleFile(null)
    setViewedSection(section)
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

  async function handleToggleTask(index: number, checked: boolean) {
    const base = optimisticContent ?? content
    if (!base) return
    const newContent = toggleTaskAtIndex(base, index, checked)
    if (newContent === base) return
    setOptimisticContent(newContent) // instant visual feedback while the save round-trips
    try {
      await handleSavePage(newContent)
      setOptimisticContent(null) // real content will now match — usePageContent picks it up
    } catch (err) {
      setOptimisticContent(null)
      window.alert((err as Error).message)
    }
  }

  async function handleToggleEditPermission(next: boolean) {
    if (!accessToken || !selectedPage) return
    setEditPermissionOverride(next) // instant feedback
    try {
      await setFileProperties(selectedPage.id, { editableByAnyone: String(next) }, accessToken)
    } catch (err) {
      setEditPermissionOverride(!next)
      window.alert((err as Error).message)
    }
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
      if (selectedNotebook?.id === deleteTarget.id) setSelectedNotebook(null)
      if (selectedPdf?.id === deleteTarget.id) setSelectedPdf(null)
      if (selectedGoogleFile?.id === deleteTarget.id) setSelectedGoogleFile(null)
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  async function handleConfirmDeleteSection() {
    if (!accessToken || !sectionToDelete) return
    try {
      await trashFile(sectionToDelete.id, accessToken)
      // The deleted section may still contain the page currently open — bail out of it either way.
      selectPage(null)
      refresh()
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  function handleDeleteItem(item: TreeItemRef) {
    setDeleteTarget({ id: item.id, label: item.label })
  }

  async function handleRenameConfirm(newLabel: string) {
    if (!accessToken || !renameTarget) return
    const finalName =
      renameTarget.kind === 'page'
        ? newLabel.toLowerCase().endsWith('.md')
          ? newLabel
          : `${newLabel}.md`
        : renameTarget.kind === 'notebook'
          ? newLabel.toLowerCase().endsWith('.ipynb')
            ? newLabel
            : `${newLabel}.ipynb`
          : newLabel
    try {
      await renameFile(renameTarget.id, finalName, accessToken)
      refresh()
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  function handleRequestMove(item: TreeItemRef, sourceParentId: string, target: { id: string; name: string }) {
    if (!tree) return
    if (item.kind === 'section') {
      const draggedSection = findSectionById(tree, item.id)
      if (draggedSection && sectionContains(draggedSection, target.id)) {
        window.alert('No se puede mover una sección dentro de sí misma o de una subsección suya.')
        return
      }
    }
    setMoveRequest({ item, sourceParentId, target })
  }

  async function handleConfirmMove() {
    if (!accessToken || !moveRequest) return
    const { item, sourceParentId, target } = moveRequest
    try {
      await moveFile(item.id, sourceParentId, target.id, accessToken)
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
          <ScrollArea className="h-[calc(100svh-9rem)]">
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
              selectedNotebookId={selectedNotebook?.id ?? null}
              selectedPdfId={selectedPdf?.id ?? null}
              selectedGoogleFileId={selectedGoogleFile?.id ?? null}
              onSelectPage={selectPage}
              onSelectNotebook={selectNotebook}
              onSelectPdf={selectPdf}
              onSelectGoogleFile={selectGoogleFile}
              onSelectSection={selectSection}
              onCreatePage={(s) => {
                setActiveSectionId(s.id)
                setCreatePageOpen(true)
              }}
              onCreateSection={(s) => {
                setActiveSectionId(s.id)
                setCreateSectionOpen(true)
              }}
              onDeleteSection={setSectionToDelete}
              onRenameItem={setRenameTarget}
              onDeleteItem={handleDeleteItem}
              onRequestMove={handleRequestMove}
            />
          </ScrollArea>
          <div className="text-muted-foreground mt-2 border-t pt-2 text-center text-xs">Build {__BUILD_ID__}</div>
        </aside>
        <section className="flex-1 overflow-y-auto p-8">
          {!selectedPage &&
            !selectedNotebook &&
            !selectedPdf &&
            !selectedGoogleFile &&
            !viewedSection &&
            !tree.indexPage && (
              <p>
                No hay <code>index.md</code> en la raíz de "{rootFolderName}" — creá uno en Drive para que sea la
                portada de la wiki, o elegí una página del árbol de la izquierda.
              </p>
            )}
          {!selectedPage && !selectedNotebook && !selectedPdf && !selectedGoogleFile && !viewedSection && tree.indexPage && (
            <p>Elegí una página del árbol de la izquierda.</p>
          )}
          {viewedSection &&
            !selectedPage &&
            !selectedNotebook &&
            !selectedPdf &&
            !selectedGoogleFile &&
            (() => {
              const vs = viewedSection
              const hasContent =
                vs.sections.length > 0 ||
                vs.pages.length > 0 ||
                (vs.notebooks ?? []).length > 0 ||
                (vs.pdfs ?? []).length > 0 ||
                (vs.googleFiles ?? []).length > 0
              return (
                <article className="mx-auto max-w-3xl">
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <div className="text-muted-foreground min-w-0 truncate text-sm">
                      {rootFolderName}
                      {viewedSectionLocation &&
                        viewedSectionLocation.path.length > 0 &&
                        ` / ${viewedSectionLocation.path.join(' / ')}`}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRenameTarget({ kind: 'section', id: vs.id, label: vs.name })}
                      >
                        <Pencil /> Renombrar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setSectionToDelete(vs)}>
                        <Trash2 /> Eliminar
                      </Button>
                    </div>
                  </div>
                  <h1 className="mb-6 text-2xl font-semibold">{vs.name}</h1>
                  {!hasContent && (
                    <p className="text-muted-foreground">
                      Esta sección está vacía. Creá una página o subsección desde el "+" del árbol.
                    </p>
                  )}
                  <ul className="flex flex-col gap-1">
                    {vs.sections.map((child) => (
                      <li key={child.id}>
                        <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => selectSection(child)}>
                          <Folder className="size-4 shrink-0 text-muted-foreground" />
                          {child.name}
                        </Button>
                      </li>
                    ))}
                    {vs.indexPage && (
                      <li key={vs.indexPage.id}>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-2"
                          onClick={() => selectPage(vs.indexPage!)}
                        >
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          {vs.indexPage.slug}
                        </Button>
                      </li>
                    )}
                    {vs.pages.map((page) => (
                      <li key={page.id}>
                        <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => selectPage(page)}>
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          {page.slug}
                        </Button>
                      </li>
                    ))}
                    {(vs.notebooks ?? []).map((notebook) => (
                      <li key={notebook.id}>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-2"
                          onClick={() => selectNotebook(notebook)}
                        >
                          <NotebookText className="size-4 shrink-0" />
                          {notebook.slug}
                        </Button>
                      </li>
                    ))}
                    {(vs.pdfs ?? []).map((pdf) => (
                      <li key={pdf.id}>
                        <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => selectPdf(pdf)}>
                          <FileText className="size-4 shrink-0 text-red-500" />
                          {pdf.name}
                        </Button>
                      </li>
                    ))}
                    {(vs.googleFiles ?? []).map((file) => (
                      <li key={file.id}>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-2"
                          onClick={() => selectGoogleFile(file)}
                        >
                          {file.type === 'gsheet' ? (
                            <FileSpreadsheet className="size-4 shrink-0 text-green-600" />
                          ) : (
                            <FileText className="size-4 shrink-0 text-blue-500" />
                          )}
                          {file.name}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </article>
              )
            })()}
          {selectedNotebook && isNotebookLoading && <p>Cargando notebook…</p>}
          {selectedNotebook && notebookError && (
            <p className="text-destructive">
              {notebookErrorReason === 'fileNotDownloadable'
                ? `"${selectedNotebook.name}" es un notebook nativo de Colab (no un archivo .ipynb de texto). Convertilo a un archivo .ipynb real ("Archivo → Descargar → .ipynb" en Colab y volvé a subirlo) para que la wiki lo pueda leer.`
                : `Error: ${notebookError}`}
            </p>
          )}
          {selectedNotebook && notebook && accessToken && (
            <article className="mx-auto max-w-3xl">
              <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
                <div className="text-muted-foreground min-w-0 truncate text-sm">
                  {rootFolderName}
                  {currentNotebookSection && currentNotebookSection.path.length > 0 &&
                    ` / ${currentNotebookSection.path.join(' / ')}`}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://colab.research.google.com/drive/${selectedNotebook.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink /> Abrir en Colab
                  </a>
                </Button>
              </div>
              <NotebookView notebook={notebook} accessToken={accessToken} />
            </article>
          )}
          {selectedPdf && accessToken && (
            <article className="mx-auto max-w-4xl">
              <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
                <div className="text-muted-foreground min-w-0 truncate text-sm">
                  {rootFolderName}
                  {currentPdfSection && currentPdfSection.path.length > 0 && ` / ${currentPdfSection.path.join(' / ')}`}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={isFavorite(selectedPdf.id) ? 'Quitar de favoritos' : 'Marcar como favorito'}
                    onClick={() => toggleFavorite(selectedPdf.id)}
                  >
                    <Star className={cn('size-4', isFavorite(selectedPdf.id) && 'fill-yellow-500 text-yellow-500')} />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" aria-label="Más opciones">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleteTarget({ id: selectedPdf.id, label: selectedPdf.name })}
                      >
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <PdfView pdf={selectedPdf} accessToken={accessToken} />
            </article>
          )}
          {selectedGoogleFile && (
            <article className="mx-auto flex max-w-3xl flex-col items-center gap-4 py-16 text-center">
              <div className="text-muted-foreground w-full truncate text-left text-sm">
                {rootFolderName}
                {currentGoogleFileSection &&
                  currentGoogleFileSection.path.length > 0 &&
                  ` / ${currentGoogleFileSection.path.join(' / ')}`}
              </div>
              {selectedGoogleFile.type === 'gsheet' ? (
                <FileSpreadsheet className="text-green-600" size={48} />
              ) : (
                <FileText className="text-blue-500" size={48} />
              )}
              <h1 className="text-xl font-semibold">{selectedGoogleFile.name}</h1>
              <p className="text-muted-foreground">
                Este archivo no se renderiza dentro de la wiki — abrilo directamente en Google{' '}
                {selectedGoogleFile.type === 'gsheet' ? 'Sheets' : 'Docs'}.
              </p>
              <Button asChild>
                <a
                  href={
                    selectedGoogleFile.type === 'gsheet'
                      ? `https://docs.google.com/spreadsheets/d/${selectedGoogleFile.id}/edit`
                      : `https://docs.google.com/document/d/${selectedGoogleFile.id}/edit`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink /> Abrir en {selectedGoogleFile.type === 'gsheet' ? 'Sheets' : 'Docs'}
                </a>
              </Button>
            </article>
          )}
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
                  {canEditPage && (
                    <Button size="sm" onClick={() => setIsEditing(true)}>
                      Editar
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" aria-label="Más opciones">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isPageCreator && (
                        <>
                          <div className="flex items-center justify-between gap-3 px-2 py-1.5 text-sm">
                            <span className="flex items-center gap-1.5">
                              {editableByAnyone ? (
                                <LockOpen className="size-3.5" />
                              ) : (
                                <Lock className="size-3.5" />
                              )}
                              Permitir edición a cualquiera
                            </span>
                            <Switch
                              checked={editableByAnyone}
                              onCheckedChange={handleToggleEditPermission}
                              aria-label="Permitir edición a cualquiera"
                            />
                          </div>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>Historial</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setDuplicateOpen(true)}>Hacer una copia</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => window.print()}>Descargar PDF</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleteTarget({ id: selectedPage.id, label: selectedPage.slug })}
                      >
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <PageByline authorship={pageAuthorship} />
              <MarkdownView
                content={optimisticContent ?? content}
                assets={currentSection?.section.assets ?? []}
                basePath={currentSection?.path ?? []}
                pathIndex={pathIndex}
                accessToken={accessToken}
                onSelectPage={selectPage}
                onToggleTask={handleToggleTask}
              />
              <footer className="mt-8 border-t pt-4 print:hidden">
                <SeenBy views={pageViews} />
              </footer>
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
      <ConfirmDeleteDialog
        open={sectionToDelete !== null}
        onOpenChange={(open) => !open && setSectionToDelete(null)}
        title={`¿Eliminar la sección "${sectionToDelete?.name}"?`}
        description="Se mueve a la papelera de Google Drive junto con todo su contenido (páginas, imágenes y subsecciones). Es recuperable desde ahí, pero no dentro de la wiki."
        onConfirm={handleConfirmDeleteSection}
      />
      {renameTarget && (
        <PromptDialog
          open={renameTarget !== null}
          onOpenChange={(open) => !open && setRenameTarget(null)}
          title="Renombrar"
          label="Nuevo nombre"
          defaultValue={renameTarget.label}
          confirmLabel="Renombrar"
          onConfirm={handleRenameConfirm}
        />
      )}
      {moveRequest && (
        <MoveConfirmDialog
          open={moveRequest !== null}
          onOpenChange={(open) => !open && setMoveRequest(null)}
          itemLabel={moveRequest.item.label}
          targetLabel={moveRequest.target.name}
          onConfirm={handleConfirmMove}
        />
      )}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deleteTarget?.label}"?</AlertDialogTitle>
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
