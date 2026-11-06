import { Link } from 'react-router'

import {
  Pagination,
  RequestState,
  RichTextEditor
} from '@/Components'
import { ProfileSidebar, SocialPageLayout } from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { Button, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useProfileMessagesPage } from './useProfileMessagesPage'
import { ProfileMessageList } from './ProfileMessageList.component'

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
        {canSendMessage ? (
          <form className="profile-message-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <Label
                id="profile-message-content-label"
                htmlFor="profile-message-content"
              >
                {t('PROFILE_MESSAGES_COMPOSE_LABEL')}
              </Label>
              <RichTextEditor
                id="profile-message-content"
                value={content}
                onChange={setContent}
                maxTextLength={4000}
                imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
                imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
                onUploadImage={uploadEditorImage}
                placeholder={t('RICH_TEXT_PLACEHOLDER')}
              />
              <p className="account-card__description">
                {t('PROFILE_MESSAGES_MAX_LENGTH')}
              </p>
            </div>
            {hasSendMessageError && (
              <p className="auth-card__error" role="alert">
                {t(
                  isInvalidMessageError
                    ? 'PROFILE_MESSAGES_ERROR_INVALID'
                    : 'PROFILE_MESSAGES_ERROR_STORAGE'
                )}
              </p>
            )}
            <Button
              type="submit"
              disabled={
                !canSubmitMessage || isSendingMessage
              }
            >
              {isSendingMessage
                ? t('AUTH_SUBMITTING')
                : t('PROFILE_MESSAGES_SEND')}
            </Button>
          </form>
        ) : (
          !isProfileOwner && (
            <p className="account-card__description">
              {session ? (
                t('PROFILE_MESSAGES_NEED_PROFILE')
              ) : (
                <>
                  {t('PROFILE_MESSAGES_SIGN_IN')}{' '}
                  <Link to={ROUTES.signIn}>{t('AUTH_SIGN_IN_LINK')}</Link>
                </>
              )}
            </p>
          )
        )}
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
            <ProfileMessageList items={messageItems} />      </div>
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
