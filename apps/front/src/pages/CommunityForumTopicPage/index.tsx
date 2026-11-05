import { Link } from 'react-router'

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

        <article className="community-forum__post community-forum__entry">
          <aside className="community-forum__author-column">
            {topicAuthor ? (
              <Link
                className="community-forum__author-link"
                to={ROUTES.profile + '/' + topicAuthor.url}
                aria-label={topicAuthor.name}
                title={topicAuthor.name}
              >
                <span className="community-forum__author-avatar">
                  {topicAuthor.picture ? (
                    <img src={topicAuthor.picture} alt="" />
                  ) : (
                    <span aria-hidden="true">
                      {topicAuthor.name.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
              </Link>
            ) : (
              <span
                className="community-forum__author-avatar"
                aria-hidden="true"
              >
                ?
              </span>
            )}
          </aside>
          <div className="community-forum__entry-main">
            <header className="community-forum__post-header">
              <span>
                {topicAuthor ? (
                  <Link to={ROUTES.profile + '/' + topicAuthor.url}>
                    {topicAuthor.name}
                  </Link>
                ) : (
                  t('FORUM_UNKNOWN_AUTHOR')
                )}
              </span>
              <time dateTime={new Date(topic.createdAt).toISOString()}>
                {new Date(topic.createdAt).toLocaleString()}
              </time>
            </header>
            <div
              className="community-forum__post-content rich-text-content"
              dangerouslySetInnerHTML={{ __html: topic.content }}
            />
            {canDeleteTopic && (
              <div className="community-forum__actions">
                {isStaff && (
                  <>
                    <Button
                      variation="secondary"
                      disabled={isUpdatingTopic}
                      onClick={() =>
                        togglePinned()
                      }
                    >
                      {t(topic.isPinned ? 'FORUM_UNPIN' : 'FORUM_PIN')}
                    </Button>
                    <Button
                      variation="secondary"
                      disabled={isUpdatingTopic}
                      onClick={() =>
                        toggleLocked()
                      }
                    >
                      {t(topic.isLocked ? 'FORUM_UNLOCK' : 'FORUM_LOCK')}
                    </Button>
                  </>
                )}
                {canDeleteTopic && (
                  <Button
                    variation="cancel"
                    disabled={isDeletingTopic}
                    onClick={deleteTopic}
                  >
                    {t('FORUM_DELETE')}
                  </Button>
                )}
              </div>
            )}
            {topic.isLocked && (
              <p className="account-card__description">{t('FORUM_LOCKED')}</p>
            )}
          </div>
        </article>

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
                <article
                  className="community-forum__reply community-forum__entry"
                  key={reply.id}
                >
                  <aside className="community-forum__author-column">
                    {author ? (
                      <Link
                        className="community-forum__author-link"
                        to={ROUTES.profile + '/' + author.url}
                        aria-label={author.name}
                        title={author.name}
                      >
                        <span className="community-forum__author-avatar">
                          {author.picture ? (
                            <img src={author.picture} alt="" />
                          ) : (
                            <span aria-hidden="true">
                              {author.name.trim().charAt(0).toUpperCase()}
                            </span>
                          )}
                        </span>
                      </Link>
                    ) : (
                      <span
                        className="community-forum__author-avatar"
                        aria-hidden="true"
                      >
                        ?
                      </span>
                    )}
                  </aside>
                  <div className="community-forum__entry-main">
                    <header className="community-forum__post-header">
                      <span>
                        {author ? (
                          <Link to={ROUTES.profile + '/' + author.url}>
                            {author.name}
                          </Link>
                        ) : (
                          t('FORUM_UNKNOWN_AUTHOR')
                        )}
                      </span>
                      <time dateTime={new Date(reply.createdAt).toISOString()}>
                        {new Date(reply.createdAt).toLocaleString()}
                      </time>
                    </header>
                    <div
                      className="community-forum__post-content rich-text-content"
                      dangerouslySetInnerHTML={{ __html: reply.content }}
                    />
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
                  </div>
                </article>
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
