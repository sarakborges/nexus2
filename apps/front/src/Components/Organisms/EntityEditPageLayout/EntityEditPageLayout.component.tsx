import { EntityFormPageLayout } from '@/Components/Organisms/EntityFormPageLayout'
import { RequestState } from '@/Components/Molecules/RequestState'
import { useTranslations } from '@/Hooks/Language'

import type { EntityEditPageLayoutProps } from './EntityEditPageLayout.types'

function LoadingState() {
  return (
    <EntityFormPageLayout>
      <RequestState isLoading />
    </EntityFormPageLayout>
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
      <EntityFormPageLayout>
        <RequestState isError onRetry={onRetry} />
      </EntityFormPageLayout>
    )
  }

  if (!isEntityAvailable) return notFound
  if (isTypeChecking) return <LoadingState />

  if (!isTypeCompatible) {
    return (
      <EntityFormPageLayout>
        <p className="profile-type-notice" role="alert">
          {t('PROFILE_TYPE_MISMATCH_NOTICE')}
        </p>
      </EntityFormPageLayout>
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
