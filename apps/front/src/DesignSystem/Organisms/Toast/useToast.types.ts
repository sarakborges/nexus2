import type { ToastProps } from './Toast.types'

export type UseToastOptions = Pick<ToastProps, 'duration' | 'onDismiss'>

export type UseToastResult = {
  isVisible: boolean
}
