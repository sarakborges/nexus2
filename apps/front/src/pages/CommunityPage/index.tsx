import { Link } from 'react-router'

import { RequestState } from '@/Components'
import { CommunitySidebar } from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useCommunityPage } from './useCommunityPage'
import { CommunityPageForumPreview } from './CommunityPageForumPreview.component'
import { CommunityPageMembersPreview } from './CommunityPageMembersPreview.component'

import '../AuthenticatedPage.style.scss'
import './CommunityPage.style.scss'

export function CommunityPage() {
  const { t } = useTranslations()
  const {
    requestedUrl,
    communityQuery,
    community,
    typeCompatibility,
    canInteract,
    relationshipsQuery,
    canViewMembers,
    canEditCommunity,
    openEditCommunity,
    members,
    memberCount,
    pendingActor,
    pendingRequestsQuery,
    membersQuery,
    forumTopicsQuery,
    forumTopics,
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
              {canEditCommunity && (
                <Button
                  type="button"
                  variation="primary"
                  onClick={openEditCommunity}
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
            {!canViewMembers ? (
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

          <CommunityPageForumPreview
            communityUrl={community.url}
            topicsQuery={forumTopicsQuery}
            authorsQuery={forumAuthorsQuery}
            topics={forumTopics}
            authorsById={forumAuthorsById}
          />
        </section>

        <aside className="social-page__right-column">
          <CommunityPageMembersPreview
            communityUrl={community.url}
            canViewMembers={canViewMembers}
            membersQuery={membersQuery}
            members={members}
            memberCount={memberCount}
          />
        </aside>
      </div>
    </main>
  )
}
