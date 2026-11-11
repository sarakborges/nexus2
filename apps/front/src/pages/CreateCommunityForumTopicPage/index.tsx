import { RelationshipActions, RequestState } from '@/Components'
import {
  CommunitySidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { CommunityForumTopicComposer } from './CommunityForumTopicComposer.component'
import { useCreateCommunityForumTopicPage } from './useCreateCommunityForumTopicPage'

import '../AuthenticatedPage.style.scss'
import '../CommunityForumPage/CommunityForumPage.style.scss'

export function CreateCommunityForumTopicPage() {
  const { t } = useTranslations()
  const {
    normalized,
    session,
    isAuthInitialized,
    composerPageQuery,
    community,
    forumProfile,
    viewerRelationship,
    typeCompatibility,
    canPublish,
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
  if (!isAuthInitialized || composerPageQuery.isLoading)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isLoading />
        </section>
      </main>
    )
  if (composerPageQuery.isError)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState
            isError
            onRetry={() => void composerPageQuery.refetch()}
          />
        </section>
      </main>
    )
  if (!community) return <NotFoundPage />

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
      <section className="community-forum social-page__content-stack">
        {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && (
          <p className="profile-type-notice" role="alert">
            {t('PROFILE_TYPE_MISMATCH_NOTICE')}
          </p>
        )}
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">{t('FORUM_NEW_TOPIC')}</h1>
            <p className="account-card__description">
              {t('FORUM_DESCRIPTION')}
            </p>
          </div>
        </header>
        {canPublish && forumProfile ? (
          <CommunityForumTopicComposer
            title={title}
            onTitleChange={setTitle}
            content={content}
            onContentChange={setContent}
            canSubmit={canSubmit}
            isSubmitting={createMutation.isPending}
            hasError={createMutation.isError}
            onSubmit={submit}
            onUploadImage={uploadEditorImage}
          />
        ) : (
          <div className="community-forum__join">
            <p className="account-card__description">
              {t('FORUM_MEMBERS_ONLY')}
            </p>
            {session && typeCompatibility.canInteract && (
              <RelationshipActions
                targetId={community.id}
                targetKind="community"
                relationship={viewerRelationship}
              />
            )}
          </div>
        )}
      </section>
    </SocialPageLayout>
  )
}
