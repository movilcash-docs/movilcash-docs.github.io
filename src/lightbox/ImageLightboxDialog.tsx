import { Minus, Plus, RotateCcw } from 'lucide-react'
import { useRef, useState, type MouseEvent, type WheelEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { LightboxContent } from './LightboxContext'

const MIN_SCALE = 0.5
const MAX_SCALE = 5
const ZOOM_STEP = 0.25

interface ImageLightboxDialogProps {
  content: LightboxContent | null
  onOpenChange: (open: boolean) => void
}

export function ImageLightboxDialog({ content, onOpenChange }: ImageLightboxDialogProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragOrigin = useRef({ startX: 0, startY: 0, originX: 0, originY: 0 })

  function reset() {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset()
    onOpenChange(open)
  }

  function zoomBy(delta: number) {
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((s + delta) * 100) / 100)))
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault()
    zoomBy(e.deltaY < 0 ? 0.15 : -0.15)
  }

  function handleMouseDown(e: MouseEvent) {
    if (scale <= 1) return
    setIsDragging(true)
    dragOrigin.current = { startX: e.clientX, startY: e.clientY, originX: position.x, originY: position.y }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return
    const { startX, startY, originX, originY } = dragOrigin.current
    setPosition({ x: originX + (e.clientX - startX), y: originY + (e.clientY - startY) })
  }

  function stopDragging() {
    setIsDragging(false)
  }

  const transform = `translate(${position.x}px, ${position.y}px) scale(${scale})`

  return (
    <Dialog open={content !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-[95vw] flex-col gap-2 p-2 sm:max-w-[95vw]">
        <DialogTitle className="sr-only">Vista ampliada</DialogTitle>
        <div className="flex items-center justify-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => zoomBy(-ZOOM_STEP)} aria-label="Alejar">
            <Minus className="size-4" />
          </Button>
          <span className="text-muted-foreground w-12 text-center text-xs">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="icon-sm" onClick={() => zoomBy(ZOOM_STEP)} aria-label="Acercar">
            <Plus className="size-4" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={reset} aria-label="Restablecer zoom">
            <RotateCcw className="size-4" />
          </Button>
        </div>
        <div
          className="bg-muted/50 flex flex-1 items-center justify-center overflow-hidden rounded-md"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDragging}
          onMouseLeave={stopDragging}
          style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          {content?.kind === 'image' && (
            <img
              src={content.src}
              alt={content.alt ?? ''}
              draggable={false}
              className="max-h-full max-w-full select-none object-contain"
              style={{ transform, transition: isDragging ? 'none' : 'transform 0.1s ease-out' }}
            />
          )}
          {content?.kind === 'svg' && (
            <div
              className="select-none [&_svg]:max-h-[80vh] [&_svg]:max-w-[88vw]"
              style={{ transform, transition: isDragging ? 'none' : 'transform 0.1s ease-out' }}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: content.markup }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
