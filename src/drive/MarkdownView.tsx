import { isValidElement, lazy, Suspense, useRef, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { cn } from 'cn'
import { getAssetBlob } from '../cache/assetCache'
import { isAbsoluteUrl } from './urlUtils'
import { resolveRelativePath, type WikiPathIndex } from './wikiPathIndex'
import type { WikiAsset, WikiPage } from './wikiTree'
import { WikiImage } from './WikiImage'

const MermaidDiagram = lazy(() => import('./MermaidDiagram').then((m) => ({ default: m.MermaidDiagram })))

const LINK_CLASS = 'text-primary underline underline-offset-2 hover:text-primary/80'

/** Extracts the raw text of a ```mermaid fenced code block, or null if `children` isn't one. */
function getMermaidCode(children: ReactNode): string | null {
  const codeElement = Array.isArray(children) ? children[0] : children
  if (!isValidElement<{ className?: string; children?: ReactNode }>(codeElement)) return null
  if (!codeElement.props.className?.includes('language-mermaid')) return null
  return String(codeElement.props.children ?? '').replace(/\n$/, '')
}

interface MarkdownViewProps {
  content: string
  /** Assets living in the same Drive folder as the page being rendered, for resolving images. */
  assets: WikiAsset[]
  /** Folder path (from the wiki root) of the page being rendered, e.g. ["arquitectura"]. */
  basePath: string[]
  pathIndex: WikiPathIndex
  accessToken: string
  onSelectPage: (page: WikiPage) => void
  /** When provided, checklist items become clickable (toggling persists via the caller). */
  onToggleTask?: (index: number, checked: boolean) => void
}

async function openAsset(asset: WikiAsset, accessToken: string) {
  const blob = await getAssetBlob(asset.id, asset.modifiedTime, accessToken)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  // Give the new tab a moment to load the blob before revoking it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function MarkdownView({
  content,
  assets,
  basePath,
  pathIndex,
  accessToken,
  onSelectPage,
  onToggleTask,
}: MarkdownViewProps) {
  // Counts checklist items in document order as they render, so each `input` knows its own
  // index (matched against the same order the raw markdown is scanned in when toggling).
  const taskIndex = useRef(0)
  taskIndex.current = 0

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        pre: ({ children, ...props }) => {
          const mermaidCode = getMermaidCode(children)
          if (mermaidCode !== null) {
            return (
              <Suspense fallback={<p className="text-muted-foreground text-sm">Cargando diagrama…</p>}>
                <MermaidDiagram code={mermaidCode} />
              </Suspense>
            )
          }
          return <pre {...props}>{children}</pre>
        },
        img: ({ src, alt }) => (
          <WikiImage src={typeof src === 'string' ? src : undefined} alt={alt} assets={assets} accessToken={accessToken} />
        ),
        li: ({ className, children, ...props }) => {
          const isTask = typeof className === 'string' && className.includes('task-list-item')
          return (
            <li
              className={cn(
                isTask &&
                  'flex list-none items-start gap-2 pl-0 [&>input]:mt-1.5 has-checked:text-emerald-600 dark:has-checked:text-emerald-500',
                className,
              )}
              {...props}
            >
              {children}
            </li>
          )
        },
        input: ({ type, checked, ...props }) => {
          if (type !== 'checkbox') return <input type={type} {...props} />
          const index = taskIndex.current++
          const isChecked = checked === true
          return (
            <input
              type="checkbox"
              checked={isChecked}
              disabled={!onToggleTask}
              onChange={() => onToggleTask?.(index, !isChecked)}
              className={cn(
                'size-4 rounded',
                isChecked ? 'accent-emerald-600' : 'accent-muted-foreground',
                onToggleTask && 'cursor-pointer',
              )}
            />
          )
        },
        a: ({ href, children }) => {
          if (!href || isAbsoluteUrl(href)) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
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
                className={LINK_CLASS}
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
                className={LINK_CLASS}
                onClick={(e) => {
                  e.preventDefault()
                  void openAsset(asset, accessToken)
                }}
              >
                {children}
              </a>
            )
          }

          return <span className="text-muted-foreground cursor-not-allowed line-through">{children}</span>
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
