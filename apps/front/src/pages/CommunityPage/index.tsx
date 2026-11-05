import { Link, useNavigate } from 'react-router'

import { RequestState } from '@/Components'
import { CommunityForumTopicList } from '@/Components/Organisms/CommunityForumTopicList/CommunityForumTopicList.component'
import { CommunitySidebar } from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useCommunityPage } from './useCommunityPage'

import '../AuthenticatedPage.style.scss'
import '../CommunityForumPage/CommunityForumPage.style.scss'
import './CommunityPage.style.scss'

export function CommunityPage() {
  const { t } = useTranslations()
  const navigate = useNavigate()
  const {
    session,
    requestedUrl,
    communityQuery,
    community,
    typeCompatibility,
    canInteract,
    relationshipsQuery,
    privateMembership,
    canViewMembers,
    pendingActor,
    pendingRequestsQuery,
    membersQuery,
    forumTopicsQuery,
    forumTopics,
    forumAuthorIds,
    forumAuthorsQuery,
    forumAuthorsById
  } = useCommunityPage()
  if (!requestedUrl) return <NotFoundPage />
  if (communityQuery.isLoading) {
    return (
      <main className="social-page">
        <div className="social-page__state">
          <RequestState isLoading />
        </div>
      </main>
    )
  }
  if (communityQuery.isError) {
    return (
      <main className="social-page">
        <div className="social-page__state">
          <RequestState isError onRetry={() => void communityQuery.refetch()} />
        </div>
      </main>
    )
  }
  if (!community) return <NotFoundPage />
  if (relationshipsQuery.isLoading) {
    return (
      <main className="social-page">
        <div className="social-page__state">
          <RequestState isLoading />
        </div>
      </main>
    )
  }
  if (relationshipsQuery.isError) {
    return (
      <main className="social-page">
        <div className="social-page__state">
          <RequestState
            isError
            onRetry={() => void relationshipsQuery.refetch()}
          />
        </div>
      </main>
    )
  }

  const members = membersQuery.data?.items ?? []
  const memberCount = membersQuery.data?.totalItems
  const ownerRelationship =
    relationshipsQuery.data?.find(
      (record) =>
        record.type === 'owner' &&
        (session?.user.profiles.includes(record.profiles[0]) ?? false)
    ) ?? null

  return (
    <main className="social-page social-page--community">
      <div className="social-page__layout">
        <aside className="social-page__left-column">
          <CommunitySidebar
            community={community}
            active="about"
            canInteract={canInteract}
          />
        </aside>

        <section className="social-page__main-column">
          <RequestState
            isFetching={
              communityQuery.isFetching || relationshipsQuery.isFetching
            }
          />
          {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && (
            <p className="profile-type-notice" role="alert">
              {t('PROFILE_TYPE_MISMATCH_NOTICE')}
            </p>
          )}
          <article className="social-panel social-panel--about">
            <header className="social-panel__header">
              <div>
                <h2 className="social-panel__title">
                  {t('COMMUNITY_ABOUT_LABEL')}
                </h2>
              </div>
              {ownerRelationship && (
                <Button
                  type="button"
                  variation="primary"
                  onClick={() =>
                    navigate(ROUTES.community + '/' + community.url + '/edit')
                  }
                >
                  {t('COMMUNITY_EDIT')}
                </Button>
              )}
            </header>
            {pendingActor &&
              (pendingRequestsQuery.data?.totalItems ?? 0) > 0 && (
                <Link
                  className="community-pending-notice"
                  to={ROUTES.community + '/' + community.url + '/members'}
                >
                  {t('COMMUNITY_PENDING_ABOUT_NOTICE', {
                    count: pendingRequestsQuery.data?.totalItems ?? 0
                  })}
                </Link>
              )}
            {community.privacy === 'private' && !privateMembership ? (
              <p className="social-panel__body">
                {t('COMMUNITY_PRIVATE_RESTRICTED')}
              </p>
            ) : community.about ? (
              <div
                className="social-panel__body rich-text-content"
                dangerouslySetInnerHTML={{ __html: community.about }}
              />
            ) : (
              <p className="social-panel__body">{t('COMMUNITY_ABOUT_EMPTY')}</p>
            )}
          </article>

          <section className="community-forum social-page__content-stack community-page__forum">
            <header className="account-card__header">
              <h2 className="account-card__title">{t('FORUM_TITLE')}</h2>
              <Link to={ROUTES.community + '/' + community.url + '/forum'}>
                {t('FORUM_VIEW_ALL')}
              </Link>
            </header>
            <RequestState
              isLoading={
                forumTopicsQuery.isLoading || forumAuthorsQuery.isLoading
              }
              isFetching={
                forumTopicsQuery.isFetching || forumAuthorsQuery.isFetching
              }
              isError={forumTopicsQuery.isError || forumAuthorsQuery.isError}
              isEmpty={
                forumTopicsQuery.isSuccess &&
                forumTopicsQuery.data.totalItems === 0
              }
              emptyMessage={t('FORUM_EMPTY')}
              onRetry={() => {
                void forumTopicsQuery.refetch()
                void forumAuthorsQuery.refetch()
              }}
            >
              <CommunityForumTopicList
                communityUrl={community.url}
                topics={forumTopics}
                authorsById={forumAuthorsById}
              />
            </RequestState>
          </section>
        </section>

        <aside className="social-page__right-column">
          <section className="social-preview-panel">
            <header className="social-preview-panel__header">
              <h2>
                {t('COMMUNITY_MEMBERS_TITLE')}
                <span className="social-preview-panel__count">
                  ({memberCount ?? '—'})
                </span>
              </h2>
              <Link
                className="social-preview-panel__all"
                to={ROUTES.community + '/' + community.url + '/members'}
              >
                {t('COMMUNITY_MEMBERS_LINK')}
              </Link>
            </header>
            <RequestState
              isLoading={canViewMembers && membersQuery.isLoading}
              isFetching={canViewMembers && membersQuery.isFetching}
              isError={canViewMembers && membersQuery.isError}
              isEmpty={
                !canViewMembers ||
                (membersQuery.isSuccess && members.length === 0)
              }
              emptyMessage={
                canViewMembers
                  ? t('COMMUNITY_MEMBERS_EMPTY')
                  : t('COMMUNITY_PRIVATE_RESTRICTED')
              }
              onRetry={() => void membersQuery.refetch()}
            >
              <div className="social-preview-grid">
                {members.map((member) => (
                  <Link
                    className="social-preview-link"
                    key={member.id}
                    to={ROUTES.profile + '/' + member.url}
                    aria-label={member.name}
                    title={member.name}
                  >
                    <PreviewAvatar
                      name={member.name}
                      picture={member.picture}
                    />
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
