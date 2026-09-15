import { useMemo, useState, type FocusEvent } from 'react'
import { flattenPages, type FlatPage } from '../drive/flattenPages'
import type { WikiPage, WikiSection } from '../drive/wikiTree'
import './TopBar.css'

interface TopBarProps {
  tree: WikiSection | null
  onSelectPage: (page: WikiPage) => void
  accountLabel: string
  onRefresh: () => void
  onChangeFolder: () => void
  onSignOut: () => void
}

function closesOnBlur(e: FocusEvent<HTMLDivElement>, close: () => void) {
  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close()
}

export function TopBar({ tree, onSelectPage, accountLabel, onRefresh, onChangeFolder, onSignOut }: TopBarProps) {
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const allPages = useMemo<FlatPage[]>(() => (tree ? flattenPages(tree) : []), [tree])
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return allPages.filter((fp) => fp.page.slug.toLowerCase().includes(q)).slice(0, 8)
  }, [allPages, query])

  function selectResult(fp: FlatPage) {
    onSelectPage(fp.page)
    setQuery('')
    setSearchOpen(false)
  }

  return (
    <header className="top-bar">
      <div className="top-bar-brand">Movilcash Docs</div>

      <div className="top-bar-search" onBlur={(e) => closesOnBlur(e, () => setSearchOpen(false))}>
        <input
          type="search"
          placeholder="Buscar páginas por nombre…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSearchOpen(true)
          }}
          onFocus={() => setSearchOpen(true)}
        />
        {searchOpen && query.trim() !== '' && (
          <ul className="top-bar-search-results">
            {results.length === 0 && <li className="empty">Sin resultados</li>}
            {results.map((fp) => (
              <li key={fp.page.id}>
                <button type="button" onClick={() => selectResult(fp)}>
                  <span className="result-name">{fp.page.slug}</span>
                  {fp.path.length > 0 && <span className="result-path">{fp.path.join(' / ')}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="top-bar-account" onBlur={(e) => closesOnBlur(e, () => setMenuOpen(false))}>
        <span className="account-label">{accountLabel}</span>
        <button
          type="button"
          className="gear-button"
          aria-label="Opciones"
          onClick={() => setMenuOpen((open) => !open)}
        >
          ⚙
        </button>
        {menuOpen && (
          <ul className="top-bar-menu">
            <li>
              <button
                type="button"
                onClick={() => {
                  onRefresh()
                  setMenuOpen(false)
                }}
              >
                Refrescar
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  onChangeFolder()
                  setMenuOpen(false)
                }}
              >
                Cambiar carpeta
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  onSignOut()
                  setMenuOpen(false)
                }}
              >
                Cerrar sesión
              </button>
            </li>
          </ul>
        )}
      </div>
    </header>
  )
}
