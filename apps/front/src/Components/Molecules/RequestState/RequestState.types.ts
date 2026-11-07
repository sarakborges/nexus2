import type { ReactNode } from 'react'

export type RequestStateProps = {
  isLoading?: boolean
  isFetching?: boolean
  isError?: boolean
  isEmpty?: boolean
  emptyMessage?: string
  errorMessage?: string
  onRetry?: () => void
  children?: ReactNode
}
