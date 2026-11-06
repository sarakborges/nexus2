import { CommunityForumEntry } from './CommunityForumEntry.component'
import { CommunityForumReplyComposer } from './CommunityForumReplyComposer.component'
import { CommunityForumTopicModerationActions } from './CommunityForumTopicModerationActions.component'
import { Pagination, RequestState } from '@/Components'
import { Button } from '@/DesignSystem'
import {
  CommunitySidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { useTranslations } from '@/Hooks/Language'
import { useCommunityForumTopicPage } from './useCommunityForumTopicPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

import '../AuthenticatedPage.style.scss'
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
    replyContent,
    setReplyContent,
    communityQuery,
    community,
    relationshipsQuery,
    ownedProfilesQuery,
    isMember,
    isStaff,
    canInteract,
    topicQuery,
    detail,
    topic,
    authorsQuery,
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
  if (communityQuery.isLoading || topicQuery.isLoading)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isLoading />
        </section>
      </main>
    )
  if (communityQuery.isError)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isError onRetry={() => void communityQuery.refetch()} />
        </section>
      </main>
    )
  if (topicQuery.isError)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isError onRetry={() => void topicQuery.refetch()} />
        </section>
      </main>
    )
  if (!community || !detail || !topic) return <NotFoundPage />

  return (
    <SocialPageLayout
      sidebar={
        <CommunitySidebar community={community} active="forum" canInteract />
      }
    >
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
          className="community-forum__post community-forum__entry"
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
            <p className="account-card__description">{t('FORUM_LOCKED')}</p>
          )}
        </CommunityForumEntry>

        <section className="community-forum__replies">
          <h2>
            {t('FORUM_REPLIES')} ({detail.replies.totalItems})
          </h2>
          <RequestState
            isLoading={
              authorsQuery.isLoading ||
              ownedProfilesQuery.isLoading ||
              relationshipsQuery.isLoading ||
              !isAuthInitialized
            }
            isFetching={topicQuery.isFetching || authorsQuery.isFetching}
            isError={
              authorsQuery.isError ||
              ownedProfilesQuery.isError ||
              relationshipsQuery.isError
            }
            onRetry={() => {
              void authorsQuery.refetch()
              void ownedProfilesQuery.refetch()
              void relationshipsQuery.refetch()
            }}
          >
            {replyItems.map(({ reply, author, canDelete }) => (
              <CommunityForumEntry
                key={reply.id}
                className="community-forum__reply community-forum__entry"
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
                  </div>
                )}
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
        isLoading={
          !isAuthInitialized ||
          relationshipsQuery.isLoading ||
          ownedProfilesQuery.isLoading
        }
        isError={relationshipsQuery.isError || ownedProfilesQuery.isError}
        onRetry={() => {
          void relationshipsQuery.refetch()
          void ownedProfilesQuery.refetch()
        }}
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
        onUploadImage={uploadEditorImage}
      />
    </SocialPageLayout>
  )
}
