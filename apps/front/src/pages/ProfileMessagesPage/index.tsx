import { Pagination, RequestState } from '@/Components'
import { ProfileSidebar, SocialPageLayout } from '@/Components/Organisms/SocialPageLayout'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProfileMessageComposer } from './ProfileMessageComposer.component'
import { ProfileMessageList } from './ProfileMessageList.component'
import { useProfileMessagesPage } from './useProfileMessagesPage'

import '../AuthenticatedPage.style.scss'

export function ProfileMessagesPage() {
  const { t } = useTranslations()
  const {
    requestedUrl,
    session,
    isAuthInitialized,
    page,
    pageSize,
    setPage,
    content,
    setContent,
    profileMessagesPageQuery,
    profile,
    viewerRelationship,
    typeCompatibility,
    isProfileOwner,
    totalItems,
    messageItems,
    canSendMessage,
    canSubmitMessage,
    uploadEditorImage,
    isSendingMessage,
    hasSendMessageError,
    isInvalidMessageError,
    handleSubmit
  } = useProfileMessagesPage()

  if (!requestedUrl) return <NotFoundPage />
  if (!isAuthInitialized || profileMessagesPageQuery.isLoading)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isLoading />
        </section>
      </main>
    )
  if (profileMessagesPageQuery.isError)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState
            isError
            onRetry={() => void profileMessagesPageQuery.refetch()}
          />
        </section>
      </main>
    )
  if (!profile) return <NotFoundPage />

  return (
    <SocialPageLayout
      sidebar={<ProfileSidebar profile={profile} active="messages" relationship={viewerRelationship} />}
    >
      <div className="social-page__content-stack">
        <RequestState isFetching={profileMessagesPageQuery.isFetching} />
        {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && (
          <p className="profile-type-notice" role="alert">
            {t('PROFILE_TYPE_MISMATCH_NOTICE')}
          </p>
        )}
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">
              {t('PROFILE_MESSAGES_TITLE', { name: profile.name })}
            </h1>
            <p className="account-card__description">
              {t(
                isProfileOwner
                  ? 'PROFILE_MESSAGES_OWNER_DESCRIPTION'
                  : 'PROFILE_MESSAGES_VISITOR_DESCRIPTION'
              )}
            </p>
          </div>
        </header>
        <ProfileMessageComposer
          hasSession={Boolean(session)}
          isProfileOwner={isProfileOwner}
          canSendMessage={canSendMessage}
          content={content}
          onContentChange={setContent}
          canSubmitMessage={canSubmitMessage}
          isSendingMessage={isSendingMessage}
          hasSendMessageError={hasSendMessageError}
          isInvalidMessageError={isInvalidMessageError}
          onUploadImage={uploadEditorImage}
          onSubmit={handleSubmit}
        />
        <RequestState
          isLoading={profileMessagesPageQuery.isLoading}
          isFetching={profileMessagesPageQuery.isFetching}
          isError={profileMessagesPageQuery.isError}
          isEmpty={
            profileMessagesPageQuery.isSuccess &&
            totalItems === 0
          }
          emptyMessage={t('PROFILE_MESSAGES_EMPTY')}
          onRetry={() => void profileMessagesPageQuery.refetch()}
        >
          <ProfileMessageList items={messageItems} />
        </RequestState>
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
        />
      </div>
    </SocialPageLayout>
  )
}
