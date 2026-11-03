import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Pagination, RequestState, RelationshipActions } from '@/Components'
import { SocialDirectoryCard } from '@/Components/Molecules'
import { ProfileSidebar, SocialPageLayout } from '@/Components/Organisms'
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
  if (profileQuery.isLoading) return <main className="social-page"><div className="social-page__state"><RequestState isLoading /></div></main>
  if (profileQuery.isError) return <main className="social-page"><div className="social-page__state"><RequestState isError onRetry={() => void profileQuery.refetch()} /></div></main>
  if (!profile) return <NotFoundPage />

  return (
    <SocialPageLayout
      className="social-page--profile-directory"
      sidebar={<ProfileSidebar profile={profile} activeSection="friends" canInteract={canInteract} />}
    >
      <header className="social-directory-header">
        <h1>{t('PROFILE_FRIENDS_TITLE', { name: profile.name })}</h1>
        <Link to={ROUTES.profile + '/' + profile.url}>{t('COMMUNITY_BACK_TO_PAGE')}</Link>
      </header>
      <RequestState
        isLoading={friendsQuery.isLoading}
        isFetching={friendsQuery.isFetching}
        isError={friendsQuery.isError}
        isEmpty={friendsQuery.isSuccess && totalItems === 0}
        emptyMessage={t('RELATIONSHIP_FRIENDS_EMPTY')}
        onRetry={() => void friendsQuery.refetch()}
      >
        <div className="social-directory-grid">
          {friends.map(friend => (
            <SocialDirectoryCard
              key={friend.id}
              name={friend.name}
              picture={friend.picture}
              meta={'@' + friend.url}
              href={ROUTES.profile + '/' + friend.url}
              actionLabel={t('DIRECTORY_OPEN_PROFILE')}
              actions={canInteract ? <RelationshipActions targetId={friend.id} /> : null}
            />
          ))}
        </div>
      </RequestState>
      <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
    </SocialPageLayout>
  )
}
