import { ChevronRight, FilePlus, FileSpreadsheet, FileText, FolderPlus, NotebookText, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { WikiGoogleFile, WikiNotebook, WikiPage, WikiPdf, WikiSection } from './wikiTree'

interface Props {
  section: WikiSection
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
  depth?: number
}

export function WikiTreeView({
  section,
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
  const [open, setOpen] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="group flex items-center gap-0.5">
        {hasChildren ? (
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="shrink-0" aria-label={open ? 'Colapsar' : 'Expandir'}>
              <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
            </Button>
          </CollapsibleTrigger>
        ) : (
          <span className="size-6 shrink-0" />
        )}
        {section.indexPage ? (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'flex-1 justify-start truncate',
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
            className="text-muted-foreground flex-1 justify-start truncate text-xs uppercase"
            onClick={() => onSelectSection(section)}
          >
            {section.name}
          </Button>
        )}
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className={cn('shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100', menuOpen && 'opacity-100')}
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
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-destructive hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={`Eliminar sección ${section.name}`}
            onClick={() => onDeleteSection(section)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
      {hasChildren && (
        <CollapsibleContent>
          <div className={cn('mt-0.5 flex flex-col gap-0.5', depth === 0 ? 'pl-3' : 'pl-3')}>
            {section.pages.map((page) => (
              <Button
                key={page.id}
                variant="ghost"
                size="sm"
                className={cn('justify-start truncate', page.id === selectedPageId && 'bg-muted font-semibold')}
                onClick={() => onSelectPage(page)}
              >
                {page.slug}
              </Button>
            ))}
            {notebooks.map((notebook) => (
              <Button
                key={notebook.id}
                variant="ghost"
                size="sm"
                className={cn(
                  'justify-start gap-1.5 truncate',
                  notebook.id === selectedNotebookId && 'bg-muted font-semibold',
                )}
                onClick={() => onSelectNotebook(notebook)}
              >
                <NotebookText className="size-3.5 shrink-0" />
                {notebook.slug}
              </Button>
            ))}
            {pdfs.map((pdf) => (
              <Button
                key={pdf.id}
                variant="ghost"
                size="sm"
                className={cn('justify-start gap-1.5 truncate', pdf.id === selectedPdfId && 'bg-muted font-semibold')}
                onClick={() => onSelectPdf(pdf)}
              >
                <FileText className="size-3.5 shrink-0 text-red-500" />
                {pdf.name}
              </Button>
            ))}
            {googleFiles.map((file) => (
              <Button
                key={file.id}
                variant="ghost"
                size="sm"
                className={cn(
                  'justify-start gap-1.5 truncate',
                  file.id === selectedGoogleFileId && 'bg-muted font-semibold',
                )}
                onClick={() => onSelectGoogleFile(file)}
              >
                {file.type === 'gsheet' ? (
                  <FileSpreadsheet className="size-3.5 shrink-0 text-green-600" />
                ) : (
                  <FileText className="size-3.5 shrink-0 text-blue-500" />
                )}
                {file.name}
              </Button>
            ))}
            {section.sections.map((child) => (
              <WikiTreeView
                key={child.id}
                section={child}
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
                depth={depth + 1}
              />
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}
