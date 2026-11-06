import type { ToastProps } from './Toast.types'
import { useToast } from './useToast'

import './Toast.style.scss'

export function Toast({
  children,
  duration = 5000,
  tone = 'info',
  role = 'status',
  onDismiss,
  className
}: ToastProps) {
  const { isVisible } = useToast({ duration, onDismiss })
  const classNames = ['toast', className].filter(Boolean).join(' ')

  if (!isVisible) return null

  return (
    <div
      className={classNames}
      data-tone={tone}
      role={role}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {children}
    </div>
  )
}
