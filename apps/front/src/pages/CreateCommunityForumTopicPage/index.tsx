import { RelationshipActions, RequestState, RichTextEditor } from '@/Components'
import {
  CommunitySidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { Button, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useCreateCommunityForumTopicPage } from './useCreateCommunityForumTopicPage'

import '../AuthenticatedPage.style.scss'
import '../CommunityForumPage/CommunityForumPage.style.scss'

export function CreateCommunityForumTopicPage() {
  const { t } = useTranslations()
  const {
    normalized,
    session,
    isAuthInitialized,
    communityQuery,
    community,
    relationshipsQuery,
    ownedProfilesQuery,
    forumProfile,
    title,
    setTitle,
    content,
    setContent,
    createMutation,
    uploadEditorImage,
    submit,
    canSubmit
  } = useCreateCommunityForumTopicPage()

  if (!normalized) return <NotFoundPage />
  if (communityQuery.isLoading)
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
  if (!community) return <NotFoundPage />

  return (
    <SocialPageLayout
      sidebar={
        <CommunitySidebar community={community} active="forum" canInteract />
      }
    >
      <section className="community-forum social-page__content-stack">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">{t('FORUM_NEW_TOPIC')}</h1>
            <p className="account-card__description">
              {t('FORUM_DESCRIPTION')}
            </p>
          </div>
        </header>
        <RequestState
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
        />
        {!isAuthInitialized ||
        relationshipsQuery.isLoading ||
        ownedProfilesQuery.isLoading ||
        relationshipsQuery.isError ||
        ownedProfilesQuery.isError ? null : forumProfile ? (
          <form className="community-forum__composer" onSubmit={submit}>
            <div className="form-field">
              <Label htmlFor="forum-topic-title">
                {t('FORUM_TOPIC_TITLE')}
              </Label>
              <input
                id="forum-topic-title"
                className="input"
                value={title}
                maxLength={140}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <Label
                id="forum-topic-content-label"
                htmlFor="forum-topic-content"
              >
                {t('FORUM_TOPIC_CONTENT')}
              </Label>
              <RichTextEditor
                id="forum-topic-content"
                value={content}
                onChange={setContent}
                maxTextLength={8000}
                imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
                imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
                onUploadImage={uploadEditorImage}
                placeholder={t('RICH_TEXT_PLACEHOLDER')}
              />
            </div>
            {createMutation.isError && (
              <p className="auth-card__error" role="alert">
                {t('FORUM_TOPIC_ERROR')}
              </p>
            )}
            <Button
              type="submit"
              disabled={
                !title.trim() ||
                !canSubmit || createMutation.isPending
              }
            >
              {t('FORUM_PUBLISH_TOPIC')}
            </Button>
          </form>
        ) : (
          <div className="community-forum__join">
            <p className="account-card__description">
              {t('FORUM_MEMBERS_ONLY')}
            </p>
            {session && (
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
