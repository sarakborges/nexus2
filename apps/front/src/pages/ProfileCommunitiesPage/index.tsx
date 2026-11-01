import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Pagination, RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useTranslations } from '@/Hooks/Language'
import { getProfileCommunities } from '@/Services/Community'
import { getProfileByUrl } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthenticatedPage.style.scss'

export function ProfileCommunitiesPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const normalized = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const profileQuery = useQuery({
    queryKey: queryKeys.profiles.byUrl(normalized),
    queryFn: () => getProfileByUrl(normalized),
    enabled: Boolean(normalized)
  })
  const profile = profileQuery.data
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
  if (profileQuery.isLoading) return <main className="account-page"><section className="account-card"><RequestState isLoading /></section></main>
  if (profileQuery.isError) return <main className="account-page"><section className="account-card"><RequestState isError onRetry={() => void profileQuery.refetch()} /></section></main>
  if (!profile) return <NotFoundPage />

  return (
    <main className="account-page"><RequestState isFetching={profileQuery.isFetching} /><section className="account-card">
      <h1 className="account-card__title">{t('PROFILE_COMMUNITIES_TITLE', { name: profile.name })}</h1>
      <RequestState
        isLoading={communitiesQuery.isLoading}
        isFetching={communitiesQuery.isFetching}
        isError={communitiesQuery.isError}
        isEmpty={communitiesQuery.isSuccess && totalItems === 0}
        emptyMessage={t('PROFILE_COMMUNITIES_EMPTY')}
        onRetry={() => void communitiesQuery.refetch()}
      >
        <div className="account-card__profile-list">{communities.map(community => (
          <div className="account-card__profile-entry" key={community.id}>
            <Link className="account-card__link" to={`${ROUTES.community}/${community.url}`}>{community.name}</Link>
          </div>
        ))}</div>
      </RequestState>
      <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
      <Link className="account-card__link" to={`${ROUTES.profile}/${profile.url}`}>{t('COMMUNITY_BACK_TO_PAGE')}</Link>
    </section></main>
  )
}
