import { createPortal } from 'react-dom'

import { Button, Modal } from '@/DesignSystem'
import type { ActionConfirmationModalProps } from './ActionConfirmationModal.types'

import './ActionConfirmationModal.style.scss'

export function ActionConfirmationModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  closeLabel,
  isConfirming = false,
  onConfirm,
  onClose
}: ActionConfirmationModalProps) {
  if (!open) return null

  const handleClose = () => {
    if (!isConfirming) onClose()
  }

  return createPortal(
    <Modal
      open
      title={title}
      onClose={handleClose}
      closeOnBackdrop={!isConfirming}
      closeLabel={closeLabel}
      className="action-confirmation-modal"
    >
      <div className="action-confirmation-modal__content">
        <p className="action-confirmation-modal__description">{description}</p>
        <div className="action-confirmation-modal__actions">
          <Button
            variation="secondary"
            type="button"
            disabled={isConfirming}
            onClick={handleClose}
          >
            {cancelLabel}
          </Button>
          <Button
            variation="cancel"
            type="button"
            disabled={isConfirming}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>,
    document.body
  )
}
