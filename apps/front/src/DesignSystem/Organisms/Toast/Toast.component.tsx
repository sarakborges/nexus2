import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import './Toast.style.scss'

export type ToastTone = 'info' | 'success' | 'warning' | 'error'

export type ToastProps = {
  children: ReactNode
  duration?: number
  tone?: ToastTone
  role?: 'status' | 'alert'
  onDismiss?: () => void
  className?: string
}

export function Toast({
  children,
  duration = 5000,
  tone = 'info',
  role = 'status',
  onDismiss,
  className
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)
  const classNames = ['toast', className].filter(Boolean).join(' ')

  useEffect(() => {
    if (!Number.isFinite(duration) || duration <= 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setIsVisible(false)
      onDismiss?.()
    }, duration)

    return () => window.clearTimeout(timeoutId)
  }, [duration, onDismiss])

  if (!isVisible) {
    return null
  }

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
