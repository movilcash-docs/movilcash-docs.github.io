import { useState } from 'react'
import type { WikiPage, WikiSection } from './wikiTree'

interface Props {
  section: WikiSection
  selectedPageId: string | null
  onSelectPage: (page: WikiPage) => void
  depth?: number
}

export function WikiTreeView({ section, selectedPageId, onSelectPage, depth = 0 }: Props) {
  const hasChildren = section.pages.length > 0 || section.sections.length > 0
  const [collapsed, setCollapsed] = useState(false)

  return (
    <ul className="wiki-tree" style={{ paddingLeft: depth === 0 ? 0 : '1rem' }}>
      <li>
        <div className="section-row">
          {hasChildren ? (
            <button
              type="button"
              className="disclosure"
              aria-label={collapsed ? 'Expandir' : 'Colapsar'}
              onClick={() => setCollapsed((c) => !c)}
            >
              {collapsed ? '▸' : '▾'}
            </button>
          ) : (
            <span className="disclosure disclosure-spacer" />
          )}
          {section.indexPage ? (
            <button
              type="button"
              className={section.indexPage.id === selectedPageId ? 'selected' : ''}
              onClick={() => onSelectPage(section.indexPage!)}
            >
              {section.name}
            </button>
          ) : (
            <span className="section-label">{section.name}</span>
          )}
        </div>
        {!collapsed && hasChildren && (
          <ul>
            {section.pages.map((page) => (
              <li key={page.id}>
                <button
                  type="button"
                  className={page.id === selectedPageId ? 'selected' : ''}
                  onClick={() => onSelectPage(page)}
                >
                  {page.slug}
                </button>
              </li>
            ))}
            {section.sections.map((child) => (
              <WikiTreeView
                key={child.id}
                section={child}
                selectedPageId={selectedPageId}
                onSelectPage={onSelectPage}
                depth={depth + 1}
              />
            ))}
          </ul>
        )}
      </li>
    </ul>
  )
}
