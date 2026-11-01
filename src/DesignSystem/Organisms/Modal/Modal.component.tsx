import { useEffect, useId, useRef } from 'react'
import type {
  MouseEvent,
  ReactNode,
  SyntheticEvent
} from 'react'

import { Text } from '@/DesignSystem/Atoms/Text'

import './Modal.style.scss'

export type ModalProps = {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  closeOnBackdrop?: boolean
  className?: string
}

export function Modal({
  open,
  title,
  children,
  onClose,
  closeOnBackdrop = true,
  className
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const classNames = ['modal', className].filter(Boolean).join(' ')

  useEffect(() => {
    const dialog = dialogRef.current

    if (!dialog) {
      return
    }

    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()
    onClose()
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={classNames}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <div className="modal__content">
        <Text as="h2" id={titleId} className="modal__title">
          {title}
        </Text>

        {children}
      </div>
    </dialog>
  )
}
