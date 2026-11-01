import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { Pagination, RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { getOwnedProfiles } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useAuthStore } from '@/Stores/Auth.store'
import '../AuthenticatedPage.style.scss'

export function HomePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslations()
  const session = useAuthStore(state => state.session)
  const setCurrentProfile = useAuthStore(state => state.setCurrentProfile)
  const signOut = useAuthStore(state => state.signOut)
  const { page, pageSize, setPage } = useUrlPagination()
  const userId = session?.user.id ?? null
  const profilesQuery = useQuery({
    queryKey: queryKeys.profiles.owned(userId ?? '', page, pageSize),
    queryFn: () => getOwnedProfiles({ page, pageSize }),
    enabled: Boolean(userId)
  })
  const profiles = profilesQuery.data?.items ?? []
  const totalItems = profilesQuery.data?.totalItems ?? 0
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.clear()
      navigate(ROUTES.signIn, { replace: true })
    }
  })
  const selectProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const success = await setCurrentProfile(profileId)
      if (!success) throw new Error('CURRENT_PROFILE_UPDATE_FAILED')
    },
    onSuccess: async () => {
      queryClient.setQueryData(queryKeys.auth.session, useAuthStore.getState().session)
      await queryClient.invalidateQueries({ queryKey: ['profiles', 'owned'] })
    }
  })

  useEffect(() => {
    if (profilesQuery.data && profilesQuery.data.page !== page) setPage(profilesQuery.data.page)
  }, [profilesQuery.data, page, setPage])

  const currentProfileId = session?.user.currentProfile

  return (
    <main className="account-page">
      <section className="account-card">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">{t('HOME_TITLE')}</h1>
            <p className="account-card__description">{t('HOME_WELCOME', { name: profiles.find(profile => profile.id === currentProfileId)?.name ?? '' })}</p>
          </div>
          <div className="account-card__header-actions">
            <Button variation="transparent" disabled={signOutMutation.isPending} onClick={() => signOutMutation.mutate()}>
              {t('AUTH_SIGN_OUT')}
            </Button>
          </div>
        </header>
        <p className="account-card__description">{session?.user.email}</p>
        <div className="account-card__profile-list">
          <h2>{t('HOME_PROFILES_TITLE')}</h2>
          <RequestState
            isLoading={profilesQuery.isLoading}
            isError={profilesQuery.isError}
            isEmpty={profilesQuery.isSuccess && totalItems === 0}
            emptyMessage={t('HOME_PROFILES_EMPTY')}
            onRetry={() => void profilesQuery.refetch()}
          >
            {profiles.map(profile => {
              const current = profile.id === currentProfileId
              return (
                <div className="account-card__profile-entry" key={profile.id}>
                  <Link className="account-card__link" to={`${ROUTES.profile}/${profile.url}`}>{profile.name} · /profile/{profile.url}</Link>
                  {current ? <span className="account-card__current-profile">{t('HOME_CURRENT_PROFILE')}</span> : <Button variation="secondary" disabled={selectProfileMutation.isPending} onClick={() => selectProfileMutation.mutate(profile.id)}>{t('HOME_USE_PROFILE')}</Button>}
                </div>
              )
            })}
          </RequestState>
          <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
        </div>
        <div className="account-card__actions">
          <Link className="account-card__action" to={ROUTES.createProfile}>{t('HOME_CREATE_PROFILE')}</Link>
          <Link className="account-card__action" to={ROUTES.communities}>{t('COMMUNITIES_TITLE')}</Link>
          <Link className="account-card__action" to={ROUTES.createCommunity}>{t('COMMUNITIES_CREATE')}</Link>
        </div>
      </section>
    </main>
  )
}
