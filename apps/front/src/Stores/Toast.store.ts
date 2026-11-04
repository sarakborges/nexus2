import { create } from 'zustand'

export type ToastTone = 'info' | 'success' | 'warning' | 'error'
export type ToastItem = { id: number; message: string; tone: ToastTone }

type ToastStore = {
  items: ToastItem[]
  showToast: (message: string, tone?: ToastTone) => void
  dismissToast: (id: number) => void
}

let nextToastId = 0

export const useToastStore = create<ToastStore>((set) => ({
  items: [],
  showToast: (message, tone = 'success') =>
    set((state) => ({
      items: [...state.items, { id: ++nextToastId, message, tone }].slice(-4)
    })),
  dismissToast: (id) =>
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
}))
