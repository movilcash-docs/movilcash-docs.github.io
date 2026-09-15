import type { WikiPage, WikiSection } from './wikiTree'

interface Props {
  section: WikiSection
  selectedPageId: string | null
  onSelectPage: (page: WikiPage) => void
  depth?: number
}

export function WikiTreeView({ section, selectedPageId, onSelectPage, depth = 0 }: Props) {
  return (
    <ul className="wiki-tree" style={{ paddingLeft: depth === 0 ? 0 : '1rem' }}>
      <li>
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
      </li>
    </ul>
  )
}
