import { RequestState } from '@/Components/Molecules/RequestState'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'

import type { EntityEditPageLayoutProps } from './EntityEditPageLayout.types'

import './EntityEditPageLayout.style.scss'

function LoadingState() {
  return (
    <main className="auth-page">
      <section className="entity-form-page">
        <RequestState isLoading />
      </section>
    </main>
  )
}

export function EntityEditPageLayout({
  title,
  description,
  titleId,
  hasValidRequest,
  isLoading,
  isError,
  onRetry,
  isEntityAvailable,
  isTypeChecking,
  isTypeCompatible,
  isFormReady,
  children
}: EntityEditPageLayoutProps) {
  const { t } = useTranslations()

  if (!hasValidRequest || (!isLoading && !isError && !isEntityAvailable)) {
    return <NotFoundPage />
  }

  if (isLoading || isTypeChecking || !isFormReady) {
    return <LoadingState />
  }

  if (isError) {
    return (
      <main className="auth-page">
        <section className="entity-form-page">
          <RequestState isError onRetry={onRetry} />
        </section>
      </main>
    )
  }

  if (!isTypeCompatible) {
    return (
      <main className="auth-page">
        <section className="entity-form-page">
          <p className="profile-type-notice" role="alert">
            {t('PROFILE_TYPE_MISMATCH_NOTICE')}
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <section
        className="entity-form-page"
        aria-labelledby={titleId}
      >
        <header className="entity-form-page__header">
          <h1 className="auth-card__title" id={titleId}>
            {title}
          </h1>
          <p className="auth-card__description">{description}</p>
        </header>
        {children}
      </section>
    </main>
  )
}
