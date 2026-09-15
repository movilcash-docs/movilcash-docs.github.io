import type { WikiSection } from './wikiTree'

export interface SectionLocation {
  section: WikiSection
  /** This section's own folder path from the wiki root (e.g. ["arquitectura"]); [] for the root itself. */
  path: string[]
}

/** Finds the section that directly contains the given page (by id), searching the whole tree. */
export function findSectionForPage(
  section: WikiSection,
  pageId: string,
  path: string[] = [],
): SectionLocation | null {
  const isHere = section.indexPage?.id === pageId || section.pages.some((p) => p.id === pageId)
  if (isHere) return { section, path }

  for (const child of section.sections) {
    const found = findSectionForPage(child, pageId, [...path, child.name])
    if (found) return found
  }
  return null
}
