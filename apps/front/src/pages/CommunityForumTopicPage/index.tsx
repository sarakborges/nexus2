import { Link } from 'react-router'

import { CommunityForumEntry } from './CommunityForumEntry.component'
import {
  Pagination,
  RelationshipActions,
  RequestState,
  RichTextEditor
} from '@/Components'
import {
  CommunitySidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { Button, Label } from '@/DesignSystem'
import { hasRichTextContent } from '@/Components/Molecules/RichTextEditor'
import { useCommunityForumTopicPage } from './useCommunityForumTopicPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

import '../AuthenticatedPage.style.scss'
import '../CommunityForumPage/CommunityForumPage.style.scss'

export function CommunityForumTopicPage() {
  const {
    topicId,
    t,
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
          {canDeleteTopic && (
            <div className="community-forum__actions">
              {isStaff && (
                <>
                  <Button
                    variation="secondary"
                    disabled={isUpdatingTopic}
                    onClick={togglePinned}
                  >
                    {t(topic.isPinned ? 'FORUM_UNPIN' : 'FORUM_PIN')}
                  </Button>
                  <Button
                    variation="secondary"
                    disabled={isUpdatingTopic}
                    onClick={toggleLocked}
                  >
                    {t(topic.isLocked ? 'FORUM_UNLOCK' : 'FORUM_LOCK')}
                  </Button>
                </>
              )}
              <Button
                variation="cancel"
                disabled={isDeletingTopic}
                onClick={deleteTopic}
              >
                {t('FORUM_DELETE')}
              </Button>
            </div>
          )}
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

      <section className="account-card community-forum community-forum__reply-composer-card">
        {!isAuthInitialized ||
        relationshipsQuery.isLoading ||
        ownedProfilesQuery.isLoading ||
        relationshipsQuery.isError ||
        ownedProfilesQuery.isError ? (
          <RequestState
            isLoading={
              !isAuthInitialized ||
              relationshipsQuery.isLoading ||
              ownedProfilesQuery.isLoading
            }
            isError={relationshipsQuery.isError || ownedProfilesQuery.isError}
          />
        ) : canInteract && isMember && !topic.isLocked ? (
          <form
            className="community-forum__reply-composer"
            onSubmit={submitReply}
          >
            <div className="form-field">
              <Label
                id="forum-reply-content-label"
                htmlFor="forum-reply-content"
              >
                {t('FORUM_REPLY')}
              </Label>
              <RichTextEditor
                id="forum-reply-content"
                value={replyContent}
                onChange={setReplyContent}
                maxTextLength={8000}
                imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
                imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
                onUploadImage={uploadEditorImage}
                placeholder={t('RICH_TEXT_PLACEHOLDER')}
              />
            </div>
            {hasReplyError && (
              <p className="auth-card__error" role="alert">
                {t('FORUM_TOPIC_ERROR')}
              </p>
            )}
            <Button
              type="submit"
              disabled={
                !hasRichTextContent(replyContent) || isSendingReply
              }
            >
              {t('FORUM_PUBLISH_REPLY')}
            </Button>
          </form>
        ) : (
          <div className="community-forum__join">
            <p className="account-card__description">
              {topic.isLocked ? t('FORUM_LOCKED') : t('FORUM_MEMBERS_ONLY')}
            </p>
            {!session && (
              <Link to={ROUTES.signIn}>{t('AUTH_SIGN_IN_LINK')}</Link>
            )}
            {session && !isMember && (
              <RelationshipActions
                targetId={community.id}
                targetKind="community"
              />
            )}
          </div>
        )}
      </section>
    </SocialPageLayout>
  )
}
