import type { WikiSection } from './wikiTree'

export interface SectionLocation {
  section: WikiSection
  /** This section's own folder path from the wiki root (e.g. ["arquitectura"]); [] for the root itself. */
  path: string[]
}

function findSectionContaining(
  section: WikiSection,
  isHere: (section: WikiSection) => boolean,
  path: string[] = [],
): SectionLocation | null {
  if (isHere(section)) return { section, path }

  for (const child of section.sections) {
    const found = findSectionContaining(child, isHere, [...path, child.name])
    if (found) return found
  }
  return null
}

/** Finds the section that directly contains the given page (by id), searching the whole tree. */
export function findSectionForPage(section: WikiSection, pageId: string): SectionLocation | null {
  return findSectionContaining(
    section,
    (s) => s.indexPage?.id === pageId || s.pages.some((p) => p.id === pageId),
  )
}

/** Finds the section that directly contains the given notebook (by id), searching the whole tree. */
export function findSectionForNotebook(section: WikiSection, notebookId: string): SectionLocation | null {
  return findSectionContaining(section, (s) => (s.notebooks ?? []).some((n) => n.id === notebookId))
}

/** Finds the section that directly contains the given PDF (by id), searching the whole tree. */
export function findSectionForPdf(section: WikiSection, pdfId: string): SectionLocation | null {
  return findSectionContaining(section, (s) => (s.pdfs ?? []).some((p) => p.id === pdfId))
}

/** Finds the section that directly contains the given Google Doc/Sheet (by id), searching the whole tree. */
export function findSectionForGoogleFile(section: WikiSection, fileId: string): SectionLocation | null {
  return findSectionContaining(section, (s) => (s.googleFiles ?? []).some((f) => f.id === fileId))
}

/** True if `sectionId` is `root` itself or one of its descendants — used to block dropping a section into itself. */
export function sectionContains(root: WikiSection, sectionId: string): boolean {
  if (root.id === sectionId) return true
  return root.sections.some((child) => sectionContains(child, sectionId))
}

/** Finds a section anywhere in the tree by its own id. */
export function findSectionById(root: WikiSection, sectionId: string): WikiSection | null {
  if (root.id === sectionId) return root
  for (const child of root.sections) {
    const found = findSectionById(child, sectionId)
    if (found) return found
  }
  return null
}
