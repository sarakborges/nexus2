import { EntityFormPageLayout } from '@/Components/Organisms/EntityFormPageLayout'
import { RequestState } from '@/Components/Molecules/RequestState'
import { useTranslations } from '@/Hooks/Language'

import type { EntityEditPageLayoutProps } from './EntityEditPageLayout.types'

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
  notFound,
  children
}: EntityEditPageLayoutProps) {
  const { t } = useTranslations()

  if (!hasValidRequest) return notFound
  if (isLoading) return <LoadingState />

  if (isError) {
    return (
      <main className="auth-page">
        <section className="entity-form-page">
          <RequestState isError onRetry={onRetry} />
        </section>
      </main>
    )
  }

  if (!isEntityAvailable) return notFound
  if (isTypeChecking) return <LoadingState />

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

  if (!isFormReady) return <LoadingState />

  return (
    <EntityFormPageLayout
      title={title}
      description={description}
      titleId={titleId}
    >
      {children}
    </EntityFormPageLayout>
  )
}
