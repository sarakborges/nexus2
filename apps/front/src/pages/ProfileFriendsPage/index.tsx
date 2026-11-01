import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Pagination, RelationshipActions, RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useTranslations } from '@/Hooks/Language'
import { getProfileFriends } from '@/Services/Relationship'
import { getProfileByUrl } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthenticatedPage.style.scss'

export function ProfileFriendsPage() {
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
  const friendsQuery = useQuery({
    queryKey: queryKeys.relationships.friends(profile?.id ?? '', page, pageSize),
    queryFn: () => getProfileFriends(profile!.id, { page, pageSize }),
    enabled: Boolean(profile?.id)
  })
  const friends = friendsQuery.data?.items ?? []
  const totalItems = friendsQuery.data?.totalItems ?? 0

  useEffect(() => {
    if (friendsQuery.data && friendsQuery.data.page !== page) setPage(friendsQuery.data.page)
  }, [friendsQuery.data, page, setPage])

  if (!normalized) return <NotFoundPage />
  if (profileQuery.isLoading) return <main className="account-page"><section className="account-card"><RequestState isLoading /></section></main>
  if (profileQuery.isError) return <main className="account-page"><section className="account-card"><RequestState isError onRetry={() => void profileQuery.refetch()} /></section></main>
  if (!profile) return <NotFoundPage />

  return (
    <main className="account-page"><RequestState isFetching={profileQuery.isFetching} /><section className="account-card">
      <h1 className="account-card__title">{t('PROFILE_FRIENDS_TITLE', { name: profile.name })}</h1>
      <RequestState
        isLoading={friendsQuery.isLoading}
        isFetching={friendsQuery.isFetching}
        isError={friendsQuery.isError}
        isEmpty={friendsQuery.isSuccess && totalItems === 0}
        emptyMessage={t('RELATIONSHIP_FRIENDS_EMPTY')}
        onRetry={() => void friendsQuery.refetch()}
      >
        <div className="account-card__profile-list">{friends.map(friend => (
          <div className="account-card__profile-entry" key={friend.id}>
            <Link className="account-card__link" to={`${ROUTES.profile}/${friend.url}`}>{friend.name}</Link>
            <RelationshipActions targetId={friend.id} />
          </div>
        ))}</div>
      </RequestState>
      <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
      <Link className="account-card__link" to={`${ROUTES.profile}/${profile.url}`}>{t('COMMUNITY_BACK_TO_PAGE')}</Link>
    </section></main>
  )
}
