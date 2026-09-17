import { Loader2, Printer, X } from 'lucide-react'
import { Previewer } from 'pagedjs'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'

interface PdfExportOverlayProps {
  /** The page's rendered article markup (same HTML the on-screen reading view shows). */
  html: string
  title: string
  onClose: () => void
}

/**
 * Serializes one CSS rule for Paged.js, resolving `@media` ourselves instead of handing it raw:
 * Paged.js's own `@media` handler throws on modern media-feature queries (Tailwind's responsive
 * breakpoints, `prefers-color-scheme`, etc. — anything whose prelude isn't a bare identifier list),
 * which aborts pagination entirely. Since this preview always renders as "print" regardless of
 * screen size or the app's theme, a `@media print` block's rules can just apply unconditionally
 * (flattened, since Paged.js's own flow isn't itself wrapped in one), and any other media query is
 * simply irrelevant to a fixed-size printed page, so it's dropped rather than risking the crash.
 */
function serializeRule(rule: CSSRule): string {
  if (rule instanceof CSSMediaRule) {
    if (!rule.media.mediaText.includes('print')) return ''
    return Array.from(rule.cssRules).map(serializeRule).join('\n')
  }
  // Any other grouping at-rule (@layer, @supports, @container, …) — recurse in case it nests a
  // @media block needing the same treatment, but keep its own wrapper so the cascade still applies
  // the way the rest of the app relies on (e.g. Tailwind's @layer ordering).
  if ('cssRules' in rule) {
    const group = rule as unknown as { cssRules: CSSRuleList; cssText: string }
    const inner = Array.from(group.cssRules).map(serializeRule).join('\n')
    const header = group.cssText.slice(0, group.cssText.indexOf('{') + 1)
    return `${header}\n${inner}\n}`
  }
  return rule.cssText
}

// @tailwindcss/typography wraps every single `.prose` rule's selector in this "opt out via
// `.not-prose`" guard — a multi-argument `:not(:where(a, b))` (Selectors Level 4). Paged.js's
// bundled css-tree can't parse it: it corrupts the selector instead of erroring cleanly, and the
// mangled result later blows up a `querySelectorAll` call deep inside Paged.js, aborting the whole
// preview. Stripping the guard back to the plain selector loses `.not-prose` opting out *inside the
// PDF preview specifically* (a rare, cosmetic-only edge case) in exchange for not crashing at all.
const NOT_PROSE_GUARD = /:not\(:where\(\[class~=[^\]]*\],\[class~=[^\]]*\]\s*\*\)\)/g

/**
 * Reads every CSS rule currently active on the page (Tailwind utilities, index.css, component
 * styles) regardless of whether it got there via a `<link>` (production build) or an injected
 * `<style>` tag (Vite dev server) — so Paged.js repaginates using the exact same styling the
 * on-screen reading view already uses, instead of us hand-maintaining a separate stylesheet.
 */
function collectPageCss(): string {
  let css = ''
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        css += serializeRule(rule) + '\n'
      }
    } catch {
      // Cross-origin stylesheet we can't read the rules of — nothing to do, skip it.
    }
  }
  return css.replace(NOT_PROSE_GUARD, '')
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

// Paged.js-only rules: real page numbers and a running header with the doc title, via the CSS
// Paged Media spec (`@page` margin boxes, `string-set`) that browsers don't implement on their
// own for window.print() — this is the whole reason to use Paged.js instead of plain print CSS.
const PAGE_RULES = `
  @page {
    size: A4;
    margin: 2cm 1.6cm 2.2cm 1.6cm;
    @bottom-center {
      content: counter(page) " / " counter(pages);
      font-family: 'Geist Variable', system-ui, sans-serif;
      font-size: 9px;
      color: #888888;
    }
    @top-center {
      content: string(doctitle);
      font-family: 'Geist Variable', system-ui, sans-serif;
      font-size: 9px;
      color: #888888;
    }
  }
  .pdf-doctitle {
    string-set: doctitle content();
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }
`

export function PdfExportOverlay({ html, title, onClose }: PdfExportOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Lets anyone confirm, straight from the browser console, that this exact lazy-loaded chunk
  // (fetched separately from the main app bundle) is the version they think it is — matches the
  // same __BUILD_ID__ shown in the sidebar footer.
  useEffect(() => {
    console.log(`[PdfExportOverlay] build ${__BUILD_ID__}`)
  }, [])

  // Hides the normal app (sidebar, topbar, the live reading view) while printing, so only this
  // overlay's already-paginated pages end up on paper — see the `.pdf-exporting` rule in index.css.
  // Also forces light theme: Tailwind's dark variant matches any descendant of `.dark` on <html>,
  // which this portal still is, so a dark-mode session would otherwise export a dark-background
  // PDF — a print preview should look the same (light) no matter which theme the app is in.
  useEffect(() => {
    document.body.classList.add('pdf-exporting')
    const wasDark = document.documentElement.classList.contains('dark')
    document.documentElement.classList.remove('dark')
    return () => {
      document.body.classList.remove('pdf-exporting')
      if (wasDark) document.documentElement.classList.add('dark')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const container = containerRef.current
    if (!container) return

    const content = `<div class="prose"><span class="pdf-doctitle">${escapeHtml(title)}</span>${html}</div>`
    const stylesheets: Record<string, string>[] = [
      { 'movilcash-docs-app': collectPageCss() },
      { 'movilcash-docs-pagedjs': PAGE_RULES },
    ]

    const previewer = new Previewer()
    previewer
      .preview(content, stylesheets, container)
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message)
      })

    return () => {
      cancelled = true
    }
  }, [html, title])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className="pdf-preview-overlay fixed inset-0 z-50 flex flex-col bg-black/50">
      <div className="pdf-preview-toolbar bg-background flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2 print:hidden">
        <span className="truncate text-sm font-medium">Vista previa de exportación — {title}</span>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" onClick={() => window.print()} disabled={!ready}>
            <Printer /> Imprimir / Guardar PDF
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>
            <X /> Cerrar
          </Button>
        </div>
      </div>
      <div className="pdf-preview-scroll bg-muted flex-1 overflow-auto p-6">
        {!ready && !error && (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-20">
            <Loader2 className="size-4 animate-spin" /> Preparando vista previa…
          </div>
        )}
        {error && <p className="text-destructive py-20 text-center">Error generando la vista previa: {error}</p>}
        <div ref={containerRef} className="pdf-preview-pages mx-auto w-fit" />
      </div>
    </div>,
    document.body,
  )
}
