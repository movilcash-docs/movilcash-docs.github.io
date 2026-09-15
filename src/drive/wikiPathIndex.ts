import type { WikiAsset, WikiPage, WikiSection } from './wikiTree'

export interface WikiPathIndex {
  pages: Map<string, WikiPage>
  assets: Map<string, WikiAsset>
}

function joinPath(segments: string[]): string {
  return segments.join('/')
}

/** Indexes every page/asset by its path relative to the wiki root (e.g. "arquitectura/index.md"). */
export function buildPathIndex(root: WikiSection): WikiPathIndex {
  const pages = new Map<string, WikiPage>()
  const assets = new Map<string, WikiAsset>()

  function walk(section: WikiSection, prefix: string[]) {
    if (section.indexPage) pages.set(joinPath([...prefix, 'index.md']), section.indexPage)
    for (const page of section.pages) pages.set(joinPath([...prefix, page.name]), page)
    for (const asset of section.assets) assets.set(joinPath([...prefix, asset.name]), asset)
    for (const child of section.sections) walk(child, [...prefix, child.name])
  }

  walk(root, [])
  return { pages, assets }
}

/**
 * Resolves a markdown-relative href (from a page living at `basePath`, e.g. ["arquitectura"])
 * into an absolute path relative to the wiki root, handling "./" and "../" segments.
 */
export function resolveRelativePath(href: string, basePath: string[]): string {
  const segments = href.split('/').filter((s) => s !== '' && s !== '.')
  const result = [...basePath]
  for (const seg of segments) {
    if (seg === '..') result.pop()
    else result.push(seg)
  }
  return joinPath(result)
}
