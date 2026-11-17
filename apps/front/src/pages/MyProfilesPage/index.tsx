import { AccountCard } from '@/Components/Atoms/AccountCard'
import { ActionConfirmationModal } from '@/Components/Molecules/ActionConfirmationModal'
import { Pagination } from '@/Components/Molecules/Pagination'
import { RequestState } from '@/Components/Molecules/RequestState'
import { EntityDirectoryGrid } from '@/Components/Organisms/EntityDirectoryGrid'
import { AuthenticatedPageState } from '@/Components/Templates/AuthenticatedPageState'
import { AuthenticatedPageTemplate } from '@/Components/Templates/AuthenticatedPageTemplate'
import { Button, ButtonLink } from '@/DesignSystem'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getProfileDuplicationLocationState } from '@/Utils/profileDuplication.utils'
import { useMyProfilesPage } from './useMyProfilesPage'

import './MyProfilesPage.style.scss'

export function MyProfilesPage() {
  const { t } = useTranslations()
  const {
    isAuthInitialized,
    currentProfileId,
    profilesQuery,
    profiles,
    page,
    pageSize,
    setPage,
    isSelectingProfile,
    isDeletingProfile,
    profileToDelete,
    selectProfile,
    requestDeleteProfile,
    cancelDeleteProfile,
    confirmDeleteProfile
  } = useMyProfilesPage()

  if (!isAuthInitialized || profilesQuery.isLoading) {
    return <AuthenticatedPageState isLoading />
  }
  if (profilesQuery.isError) {
    return (
      <AuthenticatedPageState
        isError
        onRetry={() => void profilesQuery.refetch()}
      />
    )
  }

  const totalItems = profilesQuery.data?.totalItems ?? 0
  const actionsDisabled = isSelectingProfile || isDeletingProfile

  return (
    <AuthenticatedPageTemplate>
      <AccountCard className="my-profiles-page">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">{t('HOME_PROFILES_TITLE')}</h1>
            <p className="account-card__description">
              {t('MY_PROFILES_DESCRIPTION')}
            </p>
          </div>
          <ButtonLink to={ROUTES.createProfile} variation="primary">
            {t('CREATE_PROFILE_ACTION')}
          </ButtonLink>
        </header>

        {!currentProfileId && profiles.length > 0 && (
          <p className="my-profiles-page__notice" role="status">
            {t('MY_PROFILES_NO_CURRENT_PROFILE')}
          </p>
        )}

        <RequestState
          isEmpty={profilesQuery.isSuccess && profiles.length === 0}
          emptyMessage={t('HOME_PROFILES_EMPTY')}
          emptyAction={
            <ButtonLink to={ROUTES.createProfile} variation="primary">
              {t('CREATE_PROFILE_ACTION')}
            </ButtonLink>
          }
          onRetry={() => void profilesQuery.refetch()}
        >
          <EntityDirectoryGrid
            entries={profiles.map(profile => {
              const isCurrent = profile.id === currentProfileId
              return {
                id: profile.id,
                name: profile.name,
                picture: profile.picture,
                href: ROUTES.profile + '/' + profile.url,
                secondaryText: '@' + profile.url,
                actions: (
                  <div className="my-profiles-page__actions">
                    <Button
                      type="button"
                      variation={isCurrent ? 'secondary' : 'primary'}
                      disabled={isCurrent || actionsDisabled}
                      onClick={() => selectProfile(profile.id)}
                    >
                      {isCurrent
                        ? t('HOME_CURRENT_PROFILE')
                        : t('HOME_USE_PROFILE')}
                    </Button>
                    <ButtonLink
                      to={ROUTES.createProfile}
                      state={getProfileDuplicationLocationState(profile)}
                      variation="secondary"
                      disabled={actionsDisabled}
                    >
                      {t('PROFILE_DUPLICATE')}
                    </ButtonLink>
                    <Button
                      type="button"
                      variation="cancel"
                      disabled={actionsDisabled}
                      onClick={() => requestDeleteProfile(profile)}
                    >
                      {t('PROFILE_DELETE')}
                    </Button>
                  </div>
                )
              }
            })}
          />
        </RequestState>

        {totalItems > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setPage}
          />
        )}
      </AccountCard>

      <ActionConfirmationModal
        open={Boolean(profileToDelete)}
        title={t('PROFILE_DELETE_CONFIRM_TITLE')}
        description={t('PROFILE_DELETE_CONFIRM_DESCRIPTION')}
        confirmLabel={t('PROFILE_DELETE_CONFIRM_ACTION')}
        cancelLabel={t('ACTION_CANCEL')}
        closeLabel={t('SETTINGS_CLOSE')}
        isConfirming={isDeletingProfile}
        onConfirm={confirmDeleteProfile}
        onClose={cancelDeleteProfile}
      />
    </AuthenticatedPageTemplate>
  )
}
