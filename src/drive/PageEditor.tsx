import { ImageIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createFile } from './driveApi'
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
        <Button variant="outline" size="sm" asChild disabled={isUploading}>
          <label className="cursor-pointer">
            <ImageIcon />
            {isUploading ? 'Subiendo…' : 'Insertar imagen'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isUploading}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleImageUpload(file)
                e.target.value = ''
              }}
            />
          </label>
        </Button>
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
