import type { ReactNode } from 'react'

export type ToastTone = 'info' | 'success' | 'warning' | 'error'

export type ToastProps = {
  children: ReactNode
  duration?: number
  tone?: ToastTone
  role?: 'status' | 'alert'
  onDismiss?: () => void
  className?: string
}
