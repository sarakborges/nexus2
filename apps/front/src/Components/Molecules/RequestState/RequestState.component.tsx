import type { RequestStateProps } from './RequestState.types'

import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'

import './RequestState.style.scss'

export function RequestState({
  isLoading = false,
  isError = false,
  isEmpty = false,
  emptyMessage,
  emptyAction,
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
        <p className="account-card__description">
          {errorMessage ?? t('REQUEST_FAILED')}
        </p>
        {onRetry && (
          <Button type="button" variation="secondary" onClick={onRetry}>
            {t('REQUEST_RETRY')}
          </Button>
        )}
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="request-state request-state--empty">
        <p className="request-state__empty-message">{emptyMessage}</p>
        {emptyAction && (
          <div className="request-state__empty-action">{emptyAction}</div>
        )}
      </div>
    )
  }

  return <>{children}</>
}
