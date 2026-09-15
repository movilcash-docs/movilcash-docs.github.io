import type { WikiPage, WikiSection } from './wikiTree'

export interface FlatPage {
  page: WikiPage
  /** Section names from the root down to (excluding) the page itself, for display. */
  path: string[]
}

export function flattenPages(section: WikiSection, path: string[] = []): FlatPage[] {
  const currentPath = path.length === 0 ? [] : [...path, section.name]
  const result: FlatPage[] = []

  if (section.indexPage) result.push({ page: section.indexPage, path: currentPath })
  for (const page of section.pages) result.push({ page, path: currentPath })
  for (const child of section.sections) result.push(...flattenPages(child, currentPath))

  return result
}
