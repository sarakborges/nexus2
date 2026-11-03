import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Pagination, RequestState } from '@/Components'
import { SocialDirectoryCard } from '@/Components/Molecules'
import { ProfileSidebar, SocialPageLayout } from '@/Components/Organisms'
import { ROUTES } from '@/Constants/routes'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useTranslations } from '@/Hooks/Language'
import { getProfileCommunities } from '@/Services/Community'
import { getProfileByUrl } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import '../AuthenticatedPage.style.scss'

export function ProfileCommunitiesPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const session = useAuthStore(state => state.session)
  const normalized = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const profileQuery = useQuery({
    queryKey: queryKeys.profiles.byUrl(normalized),
    queryFn: () => getProfileByUrl(normalized),
    enabled: Boolean(normalized)
  })
  const profile = profileQuery.data
  const typeCompatibility = useProfileTypeCompatibility(profile?.type ?? 'social')
  const isOwner = Boolean(profile && session?.user.profiles.includes(profile.id))
  const { page, pageSize, setPage } = useUrlPagination()
  const communitiesQuery = useQuery({
    queryKey: queryKeys.communities.byProfile(profile?.id ?? '', page, pageSize),
    queryFn: () => getProfileCommunities(profile!.id, { page, pageSize }),
    enabled: Boolean(profile?.id)
  })
  const communities = communitiesQuery.data?.items ?? []
  const totalItems = communitiesQuery.data?.totalItems ?? 0

  useEffect(() => {
    if (communitiesQuery.data && communitiesQuery.data.page !== page) setPage(communitiesQuery.data.page)
  }, [communitiesQuery.data, page, setPage])

  if (!normalized) return <NotFoundPage />
  if (profileQuery.isLoading) return <main className="social-page"><div className="social-page__state"><RequestState isLoading /></div></main>
  if (profileQuery.isError) return <main className="social-page"><div className="social-page__state"><RequestState isError onRetry={() => void profileQuery.refetch()} /></div></main>
  if (!profile) return <NotFoundPage />

  return (
    <SocialPageLayout
      className="social-page--profile-directory"
      sidebar={<ProfileSidebar profile={profile} activeSection="communities" canInteract={typeCompatibility.isCompatible && !typeCompatibility.isChecking} />}
    >
      <header className="social-directory-header">
        <h1>{t(isOwner ? 'PROFILE_MY_COMMUNITIES_TITLE' : 'PROFILE_COMMUNITIES_TITLE', { name: profile.name })}</h1>
        <Link to={ROUTES.profile + '/' + profile.url}>{t('COMMUNITY_BACK_TO_PAGE')}</Link>
      </header>
      <RequestState
        isLoading={communitiesQuery.isLoading}
        isFetching={communitiesQuery.isFetching}
        isError={communitiesQuery.isError}
        isEmpty={communitiesQuery.isSuccess && totalItems === 0}
        emptyMessage={t('PROFILE_COMMUNITIES_EMPTY')}
        onRetry={() => void communitiesQuery.refetch()}
      >
        <div className="social-directory-grid">
          {communities.map(community => (
            <SocialDirectoryCard
              key={community.id}
              name={community.name}
              picture={community.picture}
              href={ROUTES.community + '/' + community.url}
              actionLabel={t('DIRECTORY_OPEN_COMMUNITY')}
            />
          ))}
        </div>
      </RequestState>
      <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
    </SocialPageLayout>
  )
}
