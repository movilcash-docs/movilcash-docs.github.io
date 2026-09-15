import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  Table as TableIcon,
  Workflow,
} from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { createFile } from './driveApi'
import {
  getListContinuation,
  indentLines,
  insertCodeBlock,
  insertHorizontalRule,
  insertLink,
  insertMermaidDiagram,
  insertTable,
  outdentLines,
  setHeadingLevel,
  togglePrefixLines,
  wrapSelection,
  type EditorSelection,
} from './markdownEditorCommands'
import { MarkdownView } from './MarkdownView'
import type { WikiPathIndex } from './wikiPathIndex'
import type { WikiAsset } from './wikiTree'

interface PageEditorProps {
  initialContent: string
  sectionId: string
  assets: WikiAsset[]
  basePath: string[]
  pathIndex: WikiPathIndex
  accessToken: string
  onSave: (content: string) => Promise<void>
  onCancel: () => void
}

export function PageEditor({
  initialContent,
  sectionId,
  assets,
  basePath,
  pathIndex,
  accessToken,
  onSave,
  onCancel,
}: PageEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [pendingAssets, setPendingAssets] = useState<WikiAsset[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function insertAtCursor(text: string) {
    const textarea = textareaRef.current
    if (!textarea) {
      setContent((c) => c + text)
      return
    }
    const { selectionStart, selectionEnd, value } = textarea
    const next = value.slice(0, selectionStart) + text + value.slice(selectionEnd)
    setContent(next)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.selectionStart = textarea.selectionEnd = selectionStart + text.length
    })
  }

  function applyCommand(command: (sel: EditorSelection) => EditorSelection) {
    const textarea = textareaRef.current
    if (!textarea) return
    const result = command({
      value: textarea.value,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
    })
    setContent(result.value)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.selectionStart = result.selectionStart
      textarea.selectionEnd = result.selectionEnd
    })
  }

  function handleTextareaKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const hasSelection = e.currentTarget.selectionStart !== e.currentTarget.selectionEnd
      if (e.shiftKey) {
        applyCommand(outdentLines)
      } else if (hasSelection) {
        applyCommand(indentLines)
      } else {
        insertAtCursor('  ')
      }
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      const textarea = e.currentTarget
      if (textarea.selectionStart !== textarea.selectionEnd) return

      const { value } = textarea
      const cursor = textarea.selectionStart
      const lineStart = value.lastIndexOf('\n', cursor - 1) + 1
      const nextBreak = value.indexOf('\n', cursor)
      const lineEnd = nextBreak === -1 ? value.length : nextBreak
      const continuation = getListContinuation(value.slice(lineStart, lineEnd))
      if (!continuation) return

      e.preventDefault()
      // Terminating: clear the empty item's marker in place (no extra line break).
      // Continuing: keep the current line as-is, add a new line with the next marker after the cursor.
      const newValue = continuation.terminate
        ? value.slice(0, lineStart) + continuation.insert + value.slice(cursor)
        : value.slice(0, cursor) + '\n' + continuation.insert + value.slice(cursor)
      const newPos = continuation.terminate
        ? lineStart + continuation.insert.length
        : cursor + 1 + continuation.insert.length

      setContent(newValue)
      requestAnimationFrame(() => {
        textarea.focus()
        textarea.selectionStart = textarea.selectionEnd = newPos
      })
    }
  }

  async function handleImageUpload(file: File) {
    setIsUploading(true)
    setError(null)
    try {
      const created = await createFile(sectionId, file.name, file, file.type || 'application/octet-stream', accessToken)
      setPendingAssets((prev) => [
        ...prev,
        { id: created.id, name: created.name, mimeType: created.mimeType, modifiedTime: created.modifiedTime },
      ])
      // Encode the URL portion — a raw filename with spaces or parens (e.g. a screenshot named
      // "Captura realizada el 2026-09-15 17.47.10.png") would otherwise break markdown's
      // `![alt](url)` syntax, which doesn't allow literal spaces/parens in an unbracketed URL.
      insertAtCursor(`![${file.name}](${encodeURIComponent(file.name)})`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsUploading(false)
    }
  }

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    try {
      await onSave(content)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <MarkdownToolbar onCommand={applyCommand} isUploading={isUploading} onUploadImage={handleImageUpload} />
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>

      {error && <p className="text-destructive mb-3 text-sm">{error}</p>}

      <div className="flex min-h-[400px] flex-1 flex-col gap-4 md:flex-row">
        <Textarea
          ref={textareaRef}
          className="min-h-[400px] flex-1 resize-none font-mono text-sm"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleTextareaKeyDown}
          spellCheck={false}
        />
        <div className="prose dark:prose-invert max-w-none flex-1 overflow-y-auto border-t pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-4">
          <MarkdownView
            content={content}
            assets={[...assets, ...pendingAssets]}
            basePath={basePath}
            pathIndex={pathIndex}
            accessToken={accessToken}
            onSelectPage={() => {}}
          />
        </div>
      </div>
    </div>
  )
}

interface MarkdownToolbarProps {
  onCommand: (command: (sel: EditorSelection) => EditorSelection) => void
  isUploading: boolean
  onUploadImage: (file: File) => void
}

function MarkdownToolbar({ onCommand, isUploading, onUploadImage }: MarkdownToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      <ToolbarButton label="Negrita" onClick={() => onCommand((s) => wrapSelection(s, '**'))}>
        <Bold />
      </ToolbarButton>
      <ToolbarButton label="Itálica" onClick={() => onCommand((s) => wrapSelection(s, '_'))}>
        <Italic />
      </ToolbarButton>
      <ToolbarButton label="Tachado" onClick={() => onCommand((s) => wrapSelection(s, '~~'))}>
        <Strikethrough />
      </ToolbarButton>
      <ToolbarButton label="Código en línea" onClick={() => onCommand((s) => wrapSelection(s, '`'))}>
        <Code />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolbarButton label="Título 1" onClick={() => onCommand((s) => setHeadingLevel(s, 1))}>
        <Heading1 />
      </ToolbarButton>
      <ToolbarButton label="Título 2" onClick={() => onCommand((s) => setHeadingLevel(s, 2))}>
        <Heading2 />
      </ToolbarButton>
      <ToolbarButton label="Título 3" onClick={() => onCommand((s) => setHeadingLevel(s, 3))}>
        <Heading3 />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolbarButton label="Lista" onClick={() => onCommand((s) => togglePrefixLines(s, '- '))}>
        <List />
      </ToolbarButton>
      <ToolbarButton label="Lista numerada" onClick={() => onCommand((s) => togglePrefixLines(s, '1. '))}>
        <ListOrdered />
      </ToolbarButton>
      <ToolbarButton label="Checklist" onClick={() => onCommand((s) => togglePrefixLines(s, '- [ ] '))}>
        <ListChecks />
      </ToolbarButton>
      <ToolbarButton label="Cita" onClick={() => onCommand((s) => togglePrefixLines(s, '> '))}>
        <Quote />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolbarButton label="Bloque de código" onClick={() => onCommand(insertCodeBlock)}>
        <Code className="rotate-90" />
      </ToolbarButton>
      <ToolbarButton label="Link" onClick={() => onCommand(insertLink)}>
        <LinkIcon />
      </ToolbarButton>
      <ToolbarButton label="Tabla" onClick={() => onCommand(insertTable)}>
        <TableIcon />
      </ToolbarButton>
      <ToolbarButton label="Línea horizontal" onClick={() => onCommand(insertHorizontalRule)}>
        <Minus />
      </ToolbarButton>
      <ToolbarButton label="Diagrama Mermaid" onClick={() => onCommand(insertMermaidDiagram)}>
        <Workflow />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Button variant="ghost" size="icon-sm" disabled={isUploading} title="Insertar imagen" asChild>
        <label className="cursor-pointer">
          <ImageIcon />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onUploadImage(file)
              e.target.value = ''
            }}
          />
        </label>
      </Button>
    </div>
  )
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" title={label} aria-label={label} onClick={onClick}>
      {children}
    </Button>
  )
}
