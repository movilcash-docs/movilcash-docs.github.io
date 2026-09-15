import { useEffect, useState } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getRevisionText, listRevisions, type DriveRevision } from './driveApi'
import type { WikiPage } from './wikiTree'

interface VersionHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  page: WikiPage
  accessToken: string
  onRestore: (content: string) => Promise<void>
}

export function VersionHistoryDialog({ open, onOpenChange, page, accessToken, onRestore }: VersionHistoryDialogProps) {
  const [revisions, setRevisions] = useState<DriveRevision[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<DriveRevision | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  useEffect(() => {
    if (!open) return
    setRevisions(null)
    setSelected(null)
    setPreview(null)
    setError(null)
    listRevisions(page.id, accessToken)
      .then((revs) => setRevisions([...revs].reverse()))
      .catch((err) => setError((err as Error).message))
  }, [open, page.id, accessToken])

  async function selectRevision(rev: DriveRevision) {
    setSelected(rev)
    setPreview(null)
    setPreviewLoading(true)
    try {
      const text = await getRevisionText(page.id, rev.id, accessToken)
      setPreview(text)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleRestore() {
    if (preview === null) return
    setIsRestoring(true)
    try {
      await onRestore(preview)
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Historial de "{page.slug}"</DialogTitle>
        </DialogHeader>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="flex h-[60vh] gap-4">
          <ScrollArea className="w-56 shrink-0 border-r pr-2">
            {revisions === null && <p className="text-muted-foreground text-sm">Cargando…</p>}
            {revisions?.length === 0 && <p className="text-muted-foreground text-sm">Sin historial todavía.</p>}
            <div className="flex flex-col gap-1">
              {revisions?.map((rev, i) => (
                <Button
                  key={rev.id}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-auto flex-col items-start gap-0 py-2 text-left whitespace-normal',
                    selected?.id === rev.id && 'bg-muted',
                  )}
                  onClick={() => selectRevision(rev)}
                >
                  <span className="text-xs">{new Date(rev.modifiedTime).toLocaleString()}</span>
                  <span className="text-muted-foreground text-xs">
                    {rev.lastModifyingUser?.displayName ?? rev.lastModifyingUser?.emailAddress ?? 'Desconocido'}
                    {i === 0 && ' · actual'}
                  </span>
                </Button>
              ))}
            </div>
          </ScrollArea>

          <div className="flex-1 overflow-y-auto">
            {!selected && <p className="text-muted-foreground text-sm">Elegí una versión para previsualizarla.</p>}
            {selected && previewLoading && <p className="text-muted-foreground text-sm">Cargando contenido…</p>}
            {selected && !previewLoading && preview !== null && (
              <pre className="font-mono text-sm whitespace-pre-wrap">{preview}</pre>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button disabled={!selected || previewLoading || isRestoring} onClick={handleRestore}>
            {isRestoring ? 'Restaurando…' : 'Restaurar esta versión'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
