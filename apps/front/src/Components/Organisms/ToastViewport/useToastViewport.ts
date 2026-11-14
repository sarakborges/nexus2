import { useToastStore } from '@/Stores/Toast.store'
import type { UseToastViewportResult } from './useToastViewport.types'

export function useToastViewport(): UseToastViewportResult {
  const items = useToastStore((state) => state.items)
  const dismissToast = useToastStore((state) => state.dismissToast)

  return { items, dismissToast }
}
