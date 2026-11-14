import type { ReactNode } from 'react'

export type ProfileSettingsModalProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
}
