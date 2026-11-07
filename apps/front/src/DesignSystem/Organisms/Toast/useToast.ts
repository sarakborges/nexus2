import { useEffect, useState } from 'react'

import type { UseToastOptions, UseToastResult } from './useToast.types'

export function useToast({
  duration = 5000,
  onDismiss
}: UseToastOptions): UseToastResult {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (!Number.isFinite(duration) || duration <= 0) return

    const timeoutId = window.setTimeout(() => {
      setIsVisible(false)
      onDismiss?.()
    }, duration)

    return () => window.clearTimeout(timeoutId)
  }, [duration, onDismiss])

  return { isVisible }
}
