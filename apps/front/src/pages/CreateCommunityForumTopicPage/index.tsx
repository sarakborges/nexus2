import { useNavigate } from 'react-router'

import { RelationshipActions } from '@/Components'
import { AuthenticatedPageState } from '@/Components/Organisms/AuthenticatedPageState'
import {
  CommunitySidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { CommunityForumTopicComposer } from '@/Components/Molecules'
import { useCreateCommunityForumTopicPage } from './useCreateCommunityForumTopicPage'

import '../CommunityForumPage/CommunityForumPage.style.scss'

export function CreateCommunityForumTopicPage() {
  const { t } = useTranslations()
  const navigate = useNavigate()
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
  if (!isAuthInitialized || composerPageQuery.isLoading) {
    return <AuthenticatedPageState isLoading />
  }
  if (composerPageQuery.isError) {
    return (
      <AuthenticatedPageState
        isError
        onRetry={() => void composerPageQuery.refetch()}
      />
    )
  }
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
            onCancel={() => navigate(ROUTES.community + '/' + community.url + '/forum')}
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
