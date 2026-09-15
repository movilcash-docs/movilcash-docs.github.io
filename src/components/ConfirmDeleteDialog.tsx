import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmWord?: string
  onConfirm: () => void | Promise<void>
}

/** A stronger delete confirmation — requires typing a word (not just clicking) before it fires. */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmWord = 'Eliminar',
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [value, setValue] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const matches = value === confirmWord

  useEffect(() => {
    if (open) setValue('')
  }, [open])

  async function handleConfirm() {
    if (!matches) return
    setIsDeleting(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-2">
          <Label htmlFor="confirm-delete-input">
            Escribí <span className="font-semibold">{confirmWord}</span> para confirmar
          </Label>
          <Input
            id="confirm-delete-input"
            autoFocus
            autoComplete="off"
            className="mt-1.5"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" disabled={!matches || isDeleting} onClick={handleConfirm}>
            {isDeleting ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
