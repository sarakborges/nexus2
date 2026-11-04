import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { RequestState } from '@/Components'
import { CommunitySidebar } from '@/Components/Organisms/SocialPageLayout'
import { CommunityForumTopicList } from '@/Components/Organisms/CommunityForumTopicList/CommunityForumTopicList.component'
import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { getCommunityByUrl } from '@/Services/Community'
import { getCommunityForumTopics } from '@/Services/CommunityForum'
import { getCommunityMembers, getCommunityRelationships, getPendingCommunityMembers } from '@/Services/CommunityRelationship'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthenticatedPage.style.scss'
import './CommunityPage.style.scss'
import '../CommunityForumPage/CommunityForumPage.style.scss'

type PreviewAvatarProps = {
  name: string
  picture: string
}

function PreviewAvatar({ name, picture }: PreviewAvatarProps) {
  return (
    <span className="social-preview-avatar">
      {picture
        ? <img src={picture} alt="" />
        : <span aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>}
    </span>
  )
}

export function CommunityPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const navigate = useNavigate()
  const session = useAuthStore(state => state.session)
  const currentProfileId = session?.user.currentProfile ?? null
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''

  const communityQuery = useQuery({
    queryKey: queryKeys.communities.byUrl(requestedUrl),
    queryFn: () => getCommunityByUrl(requestedUrl),
    enabled: Boolean(requestedUrl)
  })
  const community = communityQuery.data
  const typeCompatibility = useProfileTypeCompatibility(community?.type ?? 'social')
  const canInteract = !session || (typeCompatibility.isCompatible && !typeCompatibility.isChecking)
  const relationshipsQuery = useQuery({
    queryKey: queryKeys.communityRelationships(community?.id ?? '', session?.user.id ?? null),
    queryFn: () => getCommunityRelationships(community!.id),
    enabled: Boolean(community?.id)
  })
  const privateMembership = relationshipsQuery.data?.some(record => ['owner', 'moderator', 'connection'].includes(record.type)) ?? false
  const canViewMembers = community?.privacy !== 'private' || privateMembership
  const pendingActor = relationshipsQuery.data?.find(record => (record.type === 'owner' || record.type === 'moderator') && (session?.user.profiles.includes(record.profiles[0]) ?? false)) ?? null
  const pendingRequestsQuery = useQuery({
    queryKey: queryKeys.pendingCommunityMembers(community?.id ?? '', pendingActor?.profiles[0] ?? '', 1, 1),
    queryFn: () => getPendingCommunityMembers(community!.id, pendingActor!.profiles[0], { page: 1, pageSize: 1 }),
    enabled: Boolean(community?.id && pendingActor)
  })
  const membersQuery = useQuery({
    queryKey: queryKeys.communityMembers(community?.id ?? '', 'all', 1, 16, currentProfileId ?? undefined),
    queryFn: () => getCommunityMembers(community!.id, 'all', { page: 1, pageSize: 16 }, currentProfileId ?? undefined),
    enabled: Boolean(community?.id && relationshipsQuery.isSuccess && canViewMembers)
  })

  const forumTopicsQuery = useQuery({
    queryKey: queryKeys.communityForumTopics(community?.id ?? '', 1, 20),
    queryFn: () => getCommunityForumTopics(community!.id, { page: 1, pageSize: 20 }),
    enabled: Boolean(community?.id && relationshipsQuery.isSuccess)
  })
  const forumTopics = forumTopicsQuery.data?.items ?? []
  const forumAuthorIds = useMemo(
    () => [...new Set(forumTopics.map(topic => topic.profileId))].sort(),
    [forumTopics]
  )
  const forumAuthorsQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(forumAuthorIds),
    queryFn: () => getProfilesByIds(forumAuthorIds),
    enabled: forumAuthorIds.length > 0
  })
  const forumAuthorsById = useMemo(
    () => new Map((forumAuthorsQuery.data ?? []).map(profile => [profile.id, profile] as const)),
    [forumAuthorsQuery.data]
  )

  if (!requestedUrl) return <NotFoundPage />
  if (communityQuery.isLoading) {
    return <main className="social-page"><div className="social-page__state"><RequestState isLoading /></div></main>
  }
  if (communityQuery.isError) {
    return <main className="social-page"><div className="social-page__state"><RequestState isError onRetry={() => void communityQuery.refetch()} /></div></main>
  }
  if (!community) return <NotFoundPage />
  if (relationshipsQuery.isLoading) {
    return <main className="social-page"><div className="social-page__state"><RequestState isLoading /></div></main>
  }
  if (relationshipsQuery.isError) {
    return <main className="social-page"><div className="social-page__state"><RequestState isError onRetry={() => void relationshipsQuery.refetch()} /></div></main>
  }

  const members = membersQuery.data?.items ?? []
  const memberCount = membersQuery.data?.totalItems
  const ownerRelationship = relationshipsQuery.data?.find(record => record.type === 'owner' && (session?.user.profiles.includes(record.profiles[0]) ?? false)) ?? null

  return (
    <main className="social-page social-page--community">
      <div className="social-page__layout">
        <aside className="social-page__left-column">
          <CommunitySidebar community={community} active="about" canInteract={canInteract} />
        </aside>

        <section className="social-page__main-column">
          <RequestState isFetching={communityQuery.isFetching || relationshipsQuery.isFetching} />
          {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && <p className="profile-type-notice" role="alert">{t('PROFILE_TYPE_MISMATCH_NOTICE')}</p>}
          <article className="social-panel social-panel--about">
            <header className="social-panel__header">
              <div>
                <h2 className="social-panel__title">{t('COMMUNITY_ABOUT_LABEL')}</h2>
              </div>
              {ownerRelationship && (
                <Button type="button" variation="primary" onClick={() => navigate(ROUTES.community + '/' + community.url + '/edit')}>
                  {t('COMMUNITY_EDIT')}
                </Button>
              )}
            </header>
            {pendingActor && (pendingRequestsQuery.data?.totalItems ?? 0) > 0 && (
              <Link className="community-pending-notice" to={ROUTES.community + '/' + community.url + '/members'}>
                {t('COMMUNITY_PENDING_ABOUT_NOTICE', { count: pendingRequestsQuery.data?.totalItems ?? 0 })}
              </Link>
            )}
            {community.privacy === 'private' && !privateMembership
              ? <p className="social-panel__body">{t('COMMUNITY_PRIVATE_RESTRICTED')}</p>
              : community.about
                ? <div className="social-panel__body rich-text-content" dangerouslySetInnerHTML={{ __html: community.about }} />
                : <p className="social-panel__body">{t('COMMUNITY_ABOUT_EMPTY')}</p>}
          </article>

          <section className="community-forum social-page__content-stack community-page__forum">
            <header className="account-card__header">
              <h2 className="account-card__title">{t('FORUM_TITLE')}</h2>
              <Link to={ROUTES.community + '/' + community.url + '/forum'}>{t('FORUM_VIEW_ALL')}</Link>
            </header>
            <RequestState
              isLoading={forumTopicsQuery.isLoading || forumAuthorsQuery.isLoading}
              isFetching={forumTopicsQuery.isFetching || forumAuthorsQuery.isFetching}
              isError={forumTopicsQuery.isError || forumAuthorsQuery.isError}
              isEmpty={forumTopicsQuery.isSuccess && forumTopicsQuery.data.totalItems === 0}
              emptyMessage={t('FORUM_EMPTY')}
              onRetry={() => {
                void forumTopicsQuery.refetch()
                void forumAuthorsQuery.refetch()
              }}
            >
              <CommunityForumTopicList communityUrl={community.url} topics={forumTopics} authorsById={forumAuthorsById} />
            </RequestState>
          </section>
        </section>

        <aside className="social-page__right-column">
          <section className="social-preview-panel">
            <header className="social-preview-panel__header">
              <h2>{t('COMMUNITY_MEMBERS_TITLE')}<span className="social-preview-panel__count">({memberCount ?? '—'})</span></h2>
              <Link className="social-preview-panel__all" to={ROUTES.community + '/' + community.url + '/members'}>{t('COMMUNITY_MEMBERS_LINK')}</Link>
            </header>
            <RequestState
              isLoading={canViewMembers && membersQuery.isLoading}
              isFetching={canViewMembers && membersQuery.isFetching}
              isError={canViewMembers && membersQuery.isError}
              isEmpty={!canViewMembers || (membersQuery.isSuccess && members.length === 0)}
              emptyMessage={canViewMembers ? t('COMMUNITY_MEMBERS_EMPTY') : t('COMMUNITY_PRIVATE_RESTRICTED')}
              onRetry={() => void membersQuery.refetch()}
            >
              <div className="social-preview-grid">
                {members.map(member => (
                  <Link className="social-preview-link" key={member.id} to={ROUTES.profile + '/' + member.url} aria-label={member.name} title={member.name}>
                    <PreviewAvatar name={member.name} picture={member.picture} />
                  </Link>
                ))}
              </div>
            </RequestState>
          </section>
        </aside>
      </div>
    </main>
  )
}
