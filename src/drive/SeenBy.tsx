import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { PageView } from './pageViews'

function personLabel(v: PageView): string {
  return v.name ?? v.email
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'recién'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return `hace ${days} d`
}

interface SeenByProps {
  views: PageView[]
}

export function SeenBy({ views }: SeenByProps) {
  const [open, setOpen] = useState(false)
  if (views.length === 0) return null

  const sorted = [...views].sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime())
  const shown = sorted.slice(0, 3)
  const extra = sorted.length - shown.length

  return (
    <>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground mb-4 block text-xs underline-offset-2 hover:underline"
        onClick={() => setOpen(true)}
      >
        Visto por {shown.map(personLabel).join(', ')}
        {extra > 0 && ` y ${extra} más`}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Visto por {sorted.length} {sorted.length === 1 ? 'persona' : 'personas'}
            </DialogTitle>
          </DialogHeader>
          <ul className="flex flex-col gap-2 text-sm">
            {sorted.map((v) => (
              <li key={v.email} className="flex items-center justify-between gap-4">
                <span className="truncate">{personLabel(v)}</span>
                <span className="text-muted-foreground shrink-0 text-xs">{formatRelative(v.viewedAt)}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
