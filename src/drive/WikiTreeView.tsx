import { ChevronRight, FilePlus, FolderPlus, Plus } from 'lucide-react'
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
import type { WikiPage, WikiSection } from './wikiTree'

interface Props {
  section: WikiSection
  selectedPageId: string | null
  onSelectPage: (page: WikiPage) => void
  onSelectSection: (section: WikiSection) => void
  onCreatePage: (section: WikiSection) => void
  onCreateSection: (section: WikiSection) => void
  depth?: number
}

export function WikiTreeView({
  section,
  selectedPageId,
  onSelectPage,
  onSelectSection,
  onCreatePage,
  onCreateSection,
  depth = 0,
}: Props) {
  const hasChildren = section.pages.length > 0 || section.sections.length > 0
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
            {section.sections.map((child) => (
              <WikiTreeView
                key={child.id}
                section={child}
                selectedPageId={selectedPageId}
                onSelectPage={onSelectPage}
                onSelectSection={onSelectSection}
                onCreatePage={onCreatePage}
                onCreateSection={onCreateSection}
                depth={depth + 1}
              />
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}
