import {
  ChevronRight,
  FilePlus,
  FileSpreadsheet,
  FileText,
  FolderPlus,
  MoreHorizontal,
  NotebookText,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { type DragEvent, type ReactNode, useState } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { TreeItemRef, WikiGoogleFile, WikiNotebook, WikiPage, WikiPdf, WikiSection } from './wikiTree'

interface DragPayload extends TreeItemRef {
  sourceParentId: string
}

function readDragPayload(e: DragEvent): DragPayload | null {
  try {
    const raw = e.dataTransfer.getData('application/x-wiki-item')
    return raw ? (JSON.parse(raw) as DragPayload) : null
  } catch {
    return null
  }
}

interface Props {
  section: WikiSection
  /** The section this instance's own row lives in; undefined for the wiki root (which can't be dragged). */
  parentSectionId?: string
  selectedPageId: string | null
  selectedNotebookId: string | null
  selectedPdfId: string | null
  selectedGoogleFileId: string | null
  onSelectPage: (page: WikiPage) => void
  onSelectNotebook: (notebook: WikiNotebook) => void
  onSelectPdf: (pdf: WikiPdf) => void
  onSelectGoogleFile: (file: WikiGoogleFile) => void
  onSelectSection: (section: WikiSection) => void
  onCreatePage: (section: WikiSection) => void
  onCreateSection: (section: WikiSection) => void
  onDeleteSection: (section: WikiSection) => void
  onRenameItem: (item: TreeItemRef) => void
  onDeleteItem: (item: TreeItemRef) => void
  onRequestMove: (item: TreeItemRef, sourceParentId: string, target: { id: string; name: string }) => void
  depth?: number
}

export function WikiTreeView({
  section,
  parentSectionId,
  selectedPageId,
  selectedNotebookId,
  selectedPdfId,
  selectedGoogleFileId,
  onSelectPage,
  onSelectNotebook,
  onSelectPdf,
  onSelectGoogleFile,
  onSelectSection,
  onCreatePage,
  onCreateSection,
  onDeleteSection,
  onRenameItem,
  onDeleteItem,
  onRequestMove,
  depth = 0,
}: Props) {
  // Defensive: these can be missing on a stale cached tree from before the field existed.
  const notebooks = section.notebooks ?? []
  const pdfs = section.pdfs ?? []
  const googleFiles = section.googleFiles ?? []
  const hasChildren =
    section.pages.length > 0 ||
    notebooks.length > 0 ||
    pdfs.length > 0 ||
    googleFiles.length > 0 ||
    section.sections.length > 0
  // Only the wiki root starts expanded; everything else starts collapsed.
  const [open, setOpen] = useState(depth === 0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [rowHovered, setRowHovered] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const actionsVisible = rowHovered || menuOpen

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const payload = readDragPayload(e)
    if (!payload) return
    if (payload.kind === 'section' && payload.id === section.id) return // dropped onto itself
    if (payload.sourceParentId === section.id) return // already here
    onRequestMove(payload, payload.sourceParentId, { id: section.id, name: section.name })
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          'flex min-w-0 items-center gap-0.5 rounded-md',
          dragOver && 'bg-accent ring-ring ring-2',
        )}
        onPointerEnter={() => setRowHovered(true)}
        onPointerLeave={() => setRowHovered(false)}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {hasChildren ? (
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="shrink-0" aria-label={open ? 'Colapsar' : 'Expandir'}>
              <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
            </Button>
          </CollapsibleTrigger>
        ) : (
          <span className="size-6 shrink-0" />
        )}
        <div
          className="min-w-0 flex-1"
          draggable={parentSectionId !== undefined}
          onDragStart={(e) => {
            if (parentSectionId === undefined) return
            const payload: DragPayload = { kind: 'section', id: section.id, label: section.name, sourceParentId: parentSectionId }
            e.dataTransfer.setData('application/x-wiki-item', JSON.stringify(payload))
            e.dataTransfer.effectAllowed = 'move'
          }}
        >
          {section.indexPage ? (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'min-w-0 w-full justify-start truncate',
                section.indexPage.id === selectedPageId && 'bg-muted font-semibold',
              )}
              onClick={() => onSelectPage(section.indexPage!)}
            >
              {section.name}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground min-w-0 w-full justify-start truncate text-xs"
              onClick={() => onSelectSection(section)}
            >
              {section.name}
            </Button>
          )}
        </div>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className={cn('shrink-0 transition-opacity focus-visible:opacity-100', actionsVisible ? 'opacity-100' : 'opacity-0')}
              aria-label={`Agregar contenido en ${section.name}`}
            >
              <Plus className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => onCreatePage(section)}>
              <FilePlus /> Página
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCreateSection(section)}>
              <FolderPlus /> Sección
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {depth > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className={cn(
                  'shrink-0 transition-opacity focus-visible:opacity-100',
                  actionsVisible ? 'opacity-100' : 'opacity-0',
                )}
                aria-label={`Opciones de ${section.name}`}
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => onRenameItem({ kind: 'section', id: section.id, label: section.name })}
              >
                <Pencil /> Renombrar
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => onDeleteSection(section)}>
                <Trash2 /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {hasChildren && (
        <CollapsibleContent>
          <div className={cn('mt-0.5 flex min-w-0 flex-col gap-0.5', depth === 0 ? 'pl-3' : 'pl-3')}>
            {section.pages.map((page) => (
              <TreeLeafItem
                key={page.id}
                item={{ kind: 'page', id: page.id, label: page.slug }}
                sourceParentId={section.id}
                selected={page.id === selectedPageId}
                onSelect={() => onSelectPage(page)}
                onRenameItem={onRenameItem}
                onDeleteItem={onDeleteItem}
              >
                {page.slug}
              </TreeLeafItem>
            ))}
            {notebooks.map((notebook) => (
              <TreeLeafItem
                key={notebook.id}
                item={{ kind: 'notebook', id: notebook.id, label: notebook.slug }}
                sourceParentId={section.id}
                selected={notebook.id === selectedNotebookId}
                onSelect={() => onSelectNotebook(notebook)}
                onRenameItem={onRenameItem}
                onDeleteItem={onDeleteItem}
              >
                <NotebookText className="size-3.5 shrink-0" />
                {notebook.slug}
              </TreeLeafItem>
            ))}
            {pdfs.map((pdf) => (
              <TreeLeafItem
                key={pdf.id}
                item={{ kind: 'pdf', id: pdf.id, label: pdf.name }}
                sourceParentId={section.id}
                selected={pdf.id === selectedPdfId}
                onSelect={() => onSelectPdf(pdf)}
                onRenameItem={onRenameItem}
                onDeleteItem={onDeleteItem}
              >
                <FileText className="size-3.5 shrink-0 text-red-500" />
                {pdf.name}
              </TreeLeafItem>
            ))}
            {googleFiles.map((file) => (
              <TreeLeafItem
                key={file.id}
                item={{ kind: file.type, id: file.id, label: file.name }}
                sourceParentId={section.id}
                selected={file.id === selectedGoogleFileId}
                onSelect={() => onSelectGoogleFile(file)}
                onRenameItem={onRenameItem}
                onDeleteItem={onDeleteItem}
              >
                {file.type === 'gsheet' ? (
                  <FileSpreadsheet className="size-3.5 shrink-0 text-green-600" />
                ) : (
                  <FileText className="size-3.5 shrink-0 text-blue-500" />
                )}
                {file.name}
              </TreeLeafItem>
            ))}
            {section.sections.map((child) => (
              <WikiTreeView
                key={child.id}
                section={child}
                parentSectionId={section.id}
                selectedPageId={selectedPageId}
                selectedNotebookId={selectedNotebookId}
                selectedPdfId={selectedPdfId}
                selectedGoogleFileId={selectedGoogleFileId}
                onSelectPage={onSelectPage}
                onSelectNotebook={onSelectNotebook}
                onSelectPdf={onSelectPdf}
                onSelectGoogleFile={onSelectGoogleFile}
                onSelectSection={onSelectSection}
                onCreatePage={onCreatePage}
                onCreateSection={onCreateSection}
                onDeleteSection={onDeleteSection}
                onRenameItem={onRenameItem}
                onDeleteItem={onDeleteItem}
                onRequestMove={onRequestMove}
                depth={depth + 1}
              />
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

interface TreeLeafItemProps {
  item: TreeItemRef
  sourceParentId: string
  selected: boolean
  onSelect: () => void
  onRenameItem: (item: TreeItemRef) => void
  onDeleteItem: (item: TreeItemRef) => void
  children: ReactNode
}

function TreeLeafItem({ item, sourceParentId, selected, onSelect, onRenameItem, onDeleteItem, children }: TreeLeafItemProps) {
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const actionsVisible = hovered || menuOpen

  return (
    <div
      className="flex min-w-0 items-center gap-0.5"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      draggable
      onDragStart={(e) => {
        const payload: DragPayload = { ...item, sourceParentId }
        e.dataTransfer.setData('application/x-wiki-item', JSON.stringify(payload))
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        className={cn('min-w-0 flex-1 justify-start gap-1.5 truncate', selected && 'bg-muted font-semibold')}
        onClick={onSelect}
      >
        {children}
      </Button>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className={cn(
              'shrink-0 transition-opacity focus-visible:opacity-100',
              actionsVisible ? 'opacity-100' : 'opacity-0',
            )}
            aria-label={`Opciones de ${item.label}`}
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onRenameItem(item)}>
            <Pencil /> Renombrar
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => onDeleteItem(item)}>
            <Trash2 /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
