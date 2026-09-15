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
  Quote,
  Strikethrough,
  Table as TableIcon,
} from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { createFile } from './driveApi'
import {
  insertCodeBlock,
  insertLink,
  insertTable,
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

  async function handleImageUpload(file: File) {
    setIsUploading(true)
    setError(null)
    try {
      const created = await createFile(sectionId, file.name, file, file.type || 'application/octet-stream', accessToken)
      setPendingAssets((prev) => [
        ...prev,
        { id: created.id, name: created.name, mimeType: created.mimeType, modifiedTime: created.modifiedTime },
      ])
      insertAtCursor(`![${file.name}](${file.name})`)
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
          spellCheck={false}
        />
        <div className="flex-1 overflow-y-auto border-t pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-4">
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
