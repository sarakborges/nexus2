import { CommunityForumEntry, CommunityForumReplyComposer, CommunityForumTopicModerationActions } from '@/Components/Molecules'
import { Pagination, RequestState } from '@/Components'
import { AuthenticatedPageState } from '@/Components/Organisms/AuthenticatedPageState'
import { PaginatedListControls } from '@/Components/Organisms/PaginatedListControls'
import { Button } from '@/DesignSystem'
import {
  CommunitySidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { useTranslations } from '@/Hooks/Language'
import { useCommunityForumTopicPage } from './useCommunityForumTopicPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

import '../CommunityForumPage/CommunityForumPage.style.scss'

export function CommunityForumTopicPage() {
  const { t } = useTranslations()
  const {
    topicId,
    session,
    isAuthInitialized,
    normalized,
    page,
    pageSize,
    setPage,
    query,
    sort,
    setQuery,
    setSort,
    replyContent,
    setReplyContent,
    topicPageQuery,
    community,
    viewerRelationship,
    typeCompatibility,
    isMember,
    isStaff,
    canInteract,
    detail,
    topic,
    submitReply,
    uploadEditorImage,
    topicAuthor,
    canDeleteTopic,
    replyItems,
    hasReplyError,
    canSubmitReply,
    isSendingReply,
    isUpdatingTopic,
    isDeletingTopic,
    isDeletingReply,
    togglePinned,
    toggleLocked,
    deleteTopic,
    deleteReply
  } = useCommunityForumTopicPage()

  if (!normalized || !topicId) return <NotFoundPage />
  if (!isAuthInitialized || topicPageQuery.isLoading) {
    return <AuthenticatedPageState isLoading />
  }
  if (topicPageQuery.isError) {
    return (
      <AuthenticatedPageState
        isError
        onRetry={() => void topicPageQuery.refetch()}
      />
    )
  }
  if (!community || !detail || !topic) return <NotFoundPage />

  return (
    <SocialPageLayout
      sidebar={
        <CommunitySidebar
          community={community}
          active="forum"
          canInteract={typeCompatibility.canInteract}
          relationship={viewerRelationship}
        />
      }
    >
      {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && (
        <p className="profile-type-notice" role="alert">
          {t('PROFILE_TYPE_MISMATCH_NOTICE')}
        </p>)}
      
      <section className="account-card community-forum community-forum__topic-detail-card">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">{topic.title}</h1>
            <p className="account-card__description">
              {t('FORUM_TITLE')} · {community.name}
            </p>
          </div>
        </header>

        <CommunityForumEntry
          className="community-forum-entry community-forum-entry--post"
          author={topicAuthor}
          content={topic.content}
          createdAt={topic.createdAt}
          unknownAuthorLabel={t('FORUM_UNKNOWN_AUTHOR')}
        >
          <CommunityForumTopicModerationActions
            canDeleteTopic={canDeleteTopic}
            isStaff={isStaff}
            isPinned={topic.isPinned}
            isLocked={topic.isLocked}
            isUpdatingTopic={isUpdatingTopic}
            isDeletingTopic={isDeletingTopic}
            onTogglePinned={togglePinned}
            onToggleLocked={toggleLocked}
            onDeleteTopic={deleteTopic}
          />
          {topic.isLocked && (
            <p className="account-card__description">{t('FORUM_LOCKED')}</p>)}
          
        </CommunityForumEntry>

        <section className="community-forum__replies">
          <h2>
            {t('FORUM_REPLIES')} ({detail.replies.totalItems})
          </h2>
          {(detail.replies.totalItems > 0 && (
            <PaginatedListControls
              key={query}
              query={query}
              sort={sort}
              onQueryChange={setQuery}
              onSortChange={setSort}
            />))}
          
          <RequestState
            isLoading={!isAuthInitialized}
            isFetching={topicPageQuery.isFetching}
            isError={topicPageQuery.isError}
            onRetry={() => void topicPageQuery.refetch()}
          >
            {replyItems.map(({ reply, author, canDelete }) => (
              <CommunityForumEntry
                key={reply.id}
                className="community-forum-entry community-forum-entry--reply"
                author={author}
                content={reply.content}
                createdAt={reply.createdAt}
                unknownAuthorLabel={t('FORUM_UNKNOWN_AUTHOR')}
              >
                {canDelete && (
                  <div className="community-forum__actions">
                    <Button
                      variation="cancel"
                      disabled={isDeletingReply}
                      onClick={() => deleteReply(reply.id)}
                    >
                      {t('FORUM_DELETE')}
                    </Button>
                  </div>)}
                
              </CommunityForumEntry>
            ))}
          </RequestState>
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={detail.replies.totalItems}
            onPageChange={setPage}
          />
        </section>
      </section>

      <CommunityForumReplyComposer
        isLoading={!isAuthInitialized}
        isError={topicPageQuery.isError}
        onRetry={() => void topicPageQuery.refetch()}
        canReply={canInteract && isMember && !topic.isLocked}
        hasSession={Boolean(session)}
        isMember={isMember}
        isTopicLocked={topic.isLocked}
        communityId={community.id}
        value={replyContent}
        canSubmit={canSubmitReply}
        isSending={isSendingReply}
        hasError={hasReplyError}
        onChange={setReplyContent}
        onSubmit={submitReply}
        onCancel={() => setReplyContent('')}
        onUploadImage={uploadEditorImage}
      />
    </SocialPageLayout>
  )
}
