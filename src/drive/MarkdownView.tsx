import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { getAssetBlob } from '../cache/assetCache'
import { isAbsoluteUrl } from './urlUtils'
import { resolveRelativePath, type WikiPathIndex } from './wikiPathIndex'
import type { WikiAsset, WikiPage } from './wikiTree'
import { WikiImage } from './WikiImage'

interface MarkdownViewProps {
  content: string
  /** Assets living in the same Drive folder as the page being rendered, for resolving images. */
  assets: WikiAsset[]
  /** Folder path (from the wiki root) of the page being rendered, e.g. ["arquitectura"]. */
  basePath: string[]
  pathIndex: WikiPathIndex
  accessToken: string
  onSelectPage: (page: WikiPage) => void
}

async function openAsset(asset: WikiAsset, accessToken: string) {
  const blob = await getAssetBlob(asset.id, asset.modifiedTime, accessToken)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  // Give the new tab a moment to load the blob before revoking it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function MarkdownView({ content, assets, basePath, pathIndex, accessToken, onSelectPage }: MarkdownViewProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        img: ({ src, alt }) => (
          <WikiImage src={typeof src === 'string' ? src : undefined} alt={alt} assets={assets} accessToken={accessToken} />
        ),
        a: ({ href, children }) => {
          if (!href || isAbsoluteUrl(href)) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            )
          }

          const resolvedPath = resolveRelativePath(href, basePath)
          const page = pathIndex.pages.get(resolvedPath)
          if (page) {
            return (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  onSelectPage(page)
                }}
              >
                {children}
              </a>
            )
          }

          const asset = pathIndex.assets.get(resolvedPath)
          if (asset) {
            return (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  void openAsset(asset, accessToken)
                }}
              >
                {children}
              </a>
            )
          }

          return <span className="broken-link">{children}</span>
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
