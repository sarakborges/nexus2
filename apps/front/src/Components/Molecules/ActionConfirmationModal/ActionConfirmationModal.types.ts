export type ActionConfirmationModalProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  closeLabel: string
  isConfirming?: boolean
  onConfirm: () => void
  onClose: () => void
}
