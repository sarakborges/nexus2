import { FiX } from 'react-icons/fi'

import { useEffect, useId, useRef } from 'react'
import type { MouseEvent, ReactNode, SyntheticEvent } from 'react'

import { Text } from '@/DesignSystem/Atoms/Text'

import './Modal.style.scss'

export type ModalProps = {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  closeOnBackdrop?: boolean
  className?: string
  closeLabel?: string
}

export function Modal({
  open,
  title,
  children,
  onClose,
  closeOnBackdrop = true,
  className,
  closeLabel = 'Close'
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
        <header className="modal__header">
          <Text as="h2" id={titleId} className="modal__title">
            {title}
          </Text>
          <button
            className="modal__close"
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <FiX aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  )
}
