import { useEffect, useId, useRef } from 'react'

import type {
  UseModalDialogOptions,
  UseModalDialogResult
} from './useModalDialog.types'

export function useModalDialog({
  open,
  onClose,
  closeOnBackdrop
}: UseModalDialogOptions): UseModalDialogResult {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current

    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const handleCancel: UseModalDialogResult['handleCancel'] = (event) => {
    event.preventDefault()
    onClose()
  }

  const handleBackdropClick: UseModalDialogResult['handleBackdropClick'] = (
    event
  ) => {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose()
    }
  }

  return { dialogRef, titleId, handleCancel, handleBackdropClick }
}
