import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Pagination, RequestState } from '@/Components'
import { SocialDirectoryCard } from '@/Components/Molecules'
import { ProfileSidebar, SocialPageLayout, SuggestedCommunities } from '@/Components/Organisms'
import { ROUTES } from '@/Constants/routes'
import { ButtonLink } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { getCommunities } from '@/Services/Community'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useAuthStore } from '@/Stores/Auth.store'
import '../AuthenticatedPage.style.scss'

export function CommunitiesPage() {
  const { t } = useTranslations()
  const session = useAuthStore(state => state.session)
  const currentProfileId = session?.user.currentProfile ?? null
  const currentProfileQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(currentProfileId ? [currentProfileId] : []),
    queryFn: () => getProfilesByIds([currentProfileId!]),
    enabled: Boolean(currentProfileId),
    staleTime: 5 * 60 * 1000
  })
  const { page, pageSize, setPage } = useUrlPagination()
  const communitiesQuery = useQuery({
    queryKey: queryKeys.communities.list(page, pageSize),
    queryFn: () => getCommunities({ page, pageSize })
  })
  const communities = communitiesQuery.data?.items ?? []
  const totalItems = communitiesQuery.data?.totalItems ?? 0
  const currentProfile = currentProfileQuery.data?.[0]

  useEffect(() => {
    if (communitiesQuery.data && communitiesQuery.data.page !== page) setPage(communitiesQuery.data.page)
  }, [communitiesQuery.data, page, setPage])

  return (
    <SocialPageLayout
      className="social-page--community-directory"
      sidebar={currentProfile
        ? <ProfileSidebar profile={currentProfile} activeSection="communities" />
        : <section className="social-sidebar-card social-sidebar-card--empty"><Link to={ROUTES.createProfile}>{t('HOME_CREATE_PROFILE')}</Link></section>}
      aside={<SuggestedCommunities />}
    >
      <header className="social-directory-header">
        <h1>{t('COMMUNITIES_TITLE')}</h1>
        <ButtonLink className="account-card__action" variation="primary" to={ROUTES.createCommunity}>{t('COMMUNITIES_CREATE')}</ButtonLink>
      </header>
      <RequestState
        isLoading={communitiesQuery.isLoading}
        isFetching={communitiesQuery.isFetching}
        isError={communitiesQuery.isError}
        isEmpty={communitiesQuery.isSuccess && totalItems === 0}
        emptyMessage={t('COMMUNITIES_EMPTY')}
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
