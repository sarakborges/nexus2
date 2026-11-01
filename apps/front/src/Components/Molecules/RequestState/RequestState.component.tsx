import type { ReactNode } from 'react'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'

type RequestStateProps = {
  isLoading?: boolean
  isError?: boolean
  isEmpty?: boolean
  emptyMessage?: string
  errorMessage?: string
  onRetry?: () => void
  children: ReactNode
}

export function RequestState({
  isLoading = false,
  isError = false,
  isEmpty = false,
  emptyMessage,
  errorMessage,
  onRetry,
  children
}: RequestStateProps) {
  const { t } = useTranslations()

  if (isLoading) {
    return (
      <div className="request-state" role="status" aria-live="polite">
        <span className="request-state__spinner" aria-hidden="true" />
        <span>{t('REQUEST_LOADING')}</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="request-state" role="alert">
        <p className="account-card__description">{errorMessage ?? t('REQUEST_FAILED')}</p>
        {onRetry && (
          <Button type="button" variation="secondary" onClick={onRetry}>
            {t('REQUEST_RETRY')}
          </Button>
        )}
      </div>
    )
  }

  if (isEmpty) {
    return <p className="account-card__description">{emptyMessage}</p>
  }

  return <>{children}</>
}
