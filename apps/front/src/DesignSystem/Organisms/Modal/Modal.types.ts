import type { ReactNode } from 'react'

export type ModalProps = {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  closeOnBackdrop?: boolean
  className?: string
  closeLabel?: string
}
