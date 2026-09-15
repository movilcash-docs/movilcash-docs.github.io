import { MoonIcon, SearchIcon, SettingsIcon, SunIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import movilcashIcon from '../assets/movilcash-icon.png'
import { flattenPages, type FlatPage } from '../drive/flattenPages'
import type { WikiPage, WikiSection } from '../drive/wikiTree'
import { useTheme } from '../theme/useTheme'

interface TopBarProps {
  tree: WikiSection | null
  onSelectPage: (page: WikiPage) => void
  accountLabel: string
  onRefresh: () => void
  onChangeFolder: () => void
  onSignOut: () => void
}

export function TopBar({ tree, onSelectPage, accountLabel, onRefresh, onChangeFolder, onSignOut }: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  const allPages = useMemo<FlatPage[]>(() => (tree ? flattenPages(tree) : []), [tree])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  function selectResult(fp: FlatPage) {
    onSelectPage(fp.page)
    setSearchOpen(false)
  }

  return (
    <header className="flex items-center gap-6 border-b px-4 py-2">
      <span className="flex shrink-0 items-center gap-2 font-bold">
        <img src={movilcashIcon} alt="" className="size-6" />
        Movilcash Docs
      </span>

      <Button
        variant="outline"
        className="text-muted-foreground mx-auto w-full max-w-md justify-start gap-2 font-normal"
        onClick={() => setSearchOpen(true)}
      >
        <SearchIcon className="size-4" />
        Buscar páginas por nombre…
        <kbd className="bg-muted ml-auto rounded px-1.5 py-0.5 font-mono text-[0.7rem]">⌘K</kbd>
      </Button>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen} title="Buscar páginas" description="Buscar páginas por nombre">
        <Command>
          <CommandInput placeholder="Buscar páginas por nombre…" />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              {allPages.map((fp) => (
                <CommandItem
                  key={fp.page.id}
                  value={`${fp.page.slug} ${fp.path.join(' ')}`}
                  onSelect={() => selectResult(fp)}
                >
                  <div className="flex flex-col">
                    <span>{fp.page.slug}</span>
                    {fp.path.length > 0 && (
                      <span className="text-muted-foreground text-xs">{fp.path.join(' / ')}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </Button>

        <span className="text-muted-foreground max-w-[220px] truncate text-sm">{accountLabel}</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Opciones">
              <SettingsIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onRefresh}>Refrescar</DropdownMenuItem>
            <DropdownMenuItem onSelect={onChangeFolder}>Cambiar carpeta</DropdownMenuItem>
            <DropdownMenuItem onSelect={onSignOut}>Cerrar sesión</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
