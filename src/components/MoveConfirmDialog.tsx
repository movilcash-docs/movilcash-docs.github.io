import { useState } from 'react'
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

interface MoveConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemLabel: string
  targetLabel: string
  onConfirm: () => Promise<void> | void
}

export function MoveConfirmDialog({ open, onOpenChange, itemLabel, targetLabel, onConfirm }: MoveConfirmDialogProps) {
  const [isMoving, setIsMoving] = useState(false)

  async function handleConfirm() {
    setIsMoving(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setIsMoving(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Mover "{itemLabel}" a "{targetLabel}"?</AlertDialogTitle>
          <AlertDialogDescription>
            Se cambia la ubicación en Drive. Si te arrepentís, podés volver a arrastrarlo a su lugar original.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isMoving}>Cancelar</AlertDialogCancel>
          <Button disabled={isMoving} onClick={handleConfirm}>
            {isMoving ? 'Moviendo…' : 'Mover'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
