import {
  Pagination,
  RequestState
} from '@/Components'
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
    page,
    pageSize,
    setPage,
    content,
    setContent,
    profileQuery,
    profile,
    typeCompatibility,
    isProfileOwner,
    messagesQuery,
    totalItems,
    senderProfilesQuery,
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
  if (profileQuery.isLoading)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isLoading />
        </section>
      </main>
    )
  if (profileQuery.isError)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isError onRetry={() => void profileQuery.refetch()} />
        </section>
      </main>
    )
  if (!profile) return <NotFoundPage />

  return (
    <SocialPageLayout
      sidebar={<ProfileSidebar profile={profile} active="messages" />}
    >
      <div className="social-page__content-stack">
        <RequestState isFetching={profileQuery.isFetching} />
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
          isLoading={messagesQuery.isLoading}
          isFetching={messagesQuery.isFetching}
          isError={messagesQuery.isError}
          isEmpty={messagesQuery.isSuccess && totalItems === 0}
          emptyMessage={t('PROFILE_MESSAGES_EMPTY')}
          onRetry={() => void messagesQuery.refetch()}
        >
          <RequestState
            isLoading={senderProfilesQuery.isLoading}
            isFetching={senderProfilesQuery.isFetching}
            isError={senderProfilesQuery.isError}
            errorMessage={t('PROFILE_MESSAGES_SENDERS_ERROR')}
            onRetry={() => void senderProfilesQuery.refetch()}
          >
            <ProfileMessageList items={messageItems} />
          </RequestState>
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
