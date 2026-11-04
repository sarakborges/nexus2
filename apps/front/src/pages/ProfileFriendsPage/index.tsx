import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Pagination, RelationshipActions, RequestState } from '@/Components'
import { ProfileSidebar, SocialPageLayout } from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useTranslations } from '@/Hooks/Language'
import { getProfileFriends } from '@/Services/Relationship'
import { getProfileByUrl } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
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
  const typeCompatibility = useProfileTypeCompatibility(profile?.type ?? 'social')
  const canInteract = typeCompatibility.isCompatible && !typeCompatibility.isChecking
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
    <SocialPageLayout sidebar={<ProfileSidebar profile={profile} active="friends" />}>
      <section className="account-card">
        <header className="account-card__header">
          <h1 className="account-card__title">{t('PROFILE_FRIENDS_TITLE')}</h1>
        </header>
        <RequestState isFetching={profileQuery.isFetching} />
        {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && <p className="profile-type-notice" role="alert">{t('PROFILE_TYPE_MISMATCH_NOTICE')}</p>}
      <RequestState
        isLoading={friendsQuery.isLoading}
        isFetching={friendsQuery.isFetching}
        isError={friendsQuery.isError}
        isEmpty={friendsQuery.isSuccess && totalItems === 0}
        emptyMessage={t('RELATIONSHIP_FRIENDS_EMPTY')}
        onRetry={() => void friendsQuery.refetch()}
      >
        <div className="account-card__profile-list account-card__profile-list--grid">{friends.map(friend => (
          <article className="account-card__profile-entry account-card__profile-entry--card" key={friend.id}>
            <Link className="account-card__profile-entry-identity" to={`${ROUTES.profile}/${friend.url}`}>
              <span className="account-card__profile-entry-avatar">
                {friend.picture
                  ? <img src={friend.picture} alt="" />
                  : <span aria-hidden="true">{friend.name.trim().charAt(0).toUpperCase()}</span>}
              </span>
              <span className="account-card__profile-entry-copy">
                <span className="account-card__link">{friend.name}</span>
                <span className="account-card__profile-entry-secondary">@{friend.url}</span>
              </span>
            </Link>
            {canInteract && <RelationshipActions targetId={friend.id} />}
          </article>
        ))}</div>
      </RequestState>
      <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
      </section>
    </SocialPageLayout>
  )
}
