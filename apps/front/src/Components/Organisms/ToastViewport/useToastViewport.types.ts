import type { ToastItem } from '@/Stores/Toast.store'

export type UseToastViewportResult = {
  items: ToastItem[]
  dismissToast: (id: number) => void
}
