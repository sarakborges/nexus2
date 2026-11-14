import type { ReactNode } from 'react'

export type EntityEditPageLayoutProps = {
  title: string
  description: string
  titleId: string
  hasValidRequest: boolean
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  isEntityAvailable: boolean
  isTypeChecking: boolean
  isTypeCompatible: boolean
  isFormReady: boolean
  notFound: ReactNode
  children: ReactNode
}
