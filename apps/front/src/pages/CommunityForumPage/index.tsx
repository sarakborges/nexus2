import { Pagination, RelationshipActions, RequestState } from '@/Components'
import { CommunityForumTopicList } from '@/Components/Organisms/CommunityForumTopicList/CommunityForumTopicList.component'
import {
  CommunitySidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useCommunityForumPage } from './useCommunityForumPage'

import '../AuthenticatedPage.style.scss'
import './CommunityForumPage.style.scss'

export function CommunityForumPage() {
  const { t } = useTranslations()
  const {
    normalized,
    isAuthInitialized,
    session,
    page,
    pageSize,
    setPage,
    forumPageQuery,
    community,
    viewerRelationship,
    typeCompatibility,
    canReadForum,
    canPublish,
    openCreateTopic,
    topics,
    authorsById
  } = useCommunityForumPage()

  if (!normalized) return <NotFoundPage />
  if (!isAuthInitialized || forumPageQuery.isLoading) {
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isLoading />
        </section>
      </main>
    )
  }
  if (forumPageQuery.isError) {
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState
            isError
            onRetry={() => void forumPageQuery.refetch()}
          />
        </section>
      </main>
    )
  }
  if (!community) return <NotFoundPage />

  return (
    <SocialPageLayout
      sidebar={
        <CommunitySidebar
          community={community}
          active="forum"
          canInteract={
            !session ||
            (typeCompatibility.isCompatible && !typeCompatibility.isChecking)
          }
          relationship={viewerRelationship}
        />
      }
    >
      <section className="community-forum social-page__content-stack">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">{t('FORUM_TITLE')}</h1>
            <p className="account-card__description">
              {t('FORUM_DESCRIPTION')}
            </p>
          </div>
          {canPublish && (
            <Button type="button" onClick={openCreateTopic}>
              {t('FORUM_NEW_TOPIC')}
            </Button>
          )}
        </header>

        <RequestState isFetching={forumPageQuery.isFetching} />
        {!canPublish && session && (
          <div className="community-forum__join">
            <p className="account-card__description">
              {t('FORUM_MEMBERS_ONLY')}
            </p>
            <RelationshipActions
              targetId={community.id}
              targetKind="community"
              relationship={viewerRelationship}
            />
          </div>
        )}

        <RequestState
          isLoading={forumPageQuery.isLoading}
          isFetching={forumPageQuery.isFetching}
          isError={forumPageQuery.isError}
          isEmpty={
            forumPageQuery.isSuccess &&
            (!canReadForum || forumPageQuery.data.topics.totalItems === 0)
          }
          emptyMessage={
            !canReadForum
              ? t('COMMUNITY_PRIVATE_RESTRICTED')
              : t('FORUM_EMPTY')
          }
          onRetry={() => void forumPageQuery.refetch()}
        >
          <CommunityForumTopicList
            communityUrl={community.url}
            topics={topics}
            authorsById={authorsById}
          />
        </RequestState>
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={forumPageQuery.data?.topics.totalItems ?? 0}
          onPageChange={setPage}
        />
      </section>
    </SocialPageLayout>
  )
}
