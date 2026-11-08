import { CommunityForumTopicComposer } from './CommunityForumTopicComposer.component'
import { RelationshipActions, RequestState } from '@/Components'
import {
  CommunitySidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
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
