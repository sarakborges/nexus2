import { FiX } from 'react-icons/fi'

import { Text } from '@/DesignSystem/Atoms/Text'

import type { ModalProps } from './Modal.types'
import { useModalDialog } from './useModalDialog'

import './Modal.style.scss'

export function Modal({
  open,
  title,
  children,
  onClose,
  closeOnBackdrop = true,
  className,
  closeLabel = 'Close'
}: ModalProps) {
  const { dialogRef, titleId, handleCancel, handleBackdropClick } = useModalDialog({
    open,
    onClose,
    closeOnBackdrop
  })
  const classNames = ['modal', className].filter(Boolean).join(' ')

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
