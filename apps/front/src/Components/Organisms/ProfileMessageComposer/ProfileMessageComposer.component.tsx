import { Link } from 'react-router'

import { ComposerActions, RichTextComposerField } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import type { ProfileMessageComposerProps } from './ProfileMessageComposer.types'

import './ProfileMessageComposer.style.scss'

export function ProfileMessageComposer({
  hasSession,
  isProfileOwner,
  canSendMessage,
  content,
  onContentChange,
  canSubmitMessage,
  isSendingMessage,
  hasSendMessageError,
  isInvalidMessageError,
  onUploadImage,
  onSubmit,
  replyToName,
  onCancelReply
}: ProfileMessageComposerProps) {
  const { t } = useTranslations()

  if (!canSendMessage) {
    if (isProfileOwner) return null

    return (
      <p className="account-card__description">
        {hasSession ? (
          t('PROFILE_MESSAGES_NEED_PROFILE')
        ) : (
          <>
            {t('PROFILE_MESSAGES_SIGN_IN')}{' '}
            <Link to={ROUTES.signIn}>{t('AUTH_SIGN_IN_LINK')}</Link>
          </>
        )}
      </p>
    )
  }

  return (
    <form className="profile-message-form" onSubmit={onSubmit}>
      {replyToName && (
        <div className="profile-message-form__reply-context">
          <span>{t('PROFILE_MESSAGE_REPLYING_TO', { name: replyToName })}</span>
          <Button type="button" variation="transparent" onClick={onCancelReply}>
            {t('PROFILE_MESSAGE_CANCEL_REPLY')}
          </Button>
        </div>
      )}
      <RichTextComposerField
        id="profile-message-content"
        label={t('PROFILE_MESSAGES_COMPOSE_LABEL')}
        value={content}
        onChange={onContentChange}
        maxHtmlLength={8000}
        imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
        imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
        onUploadImage={onUploadImage}
        placeholder={t('RICH_TEXT_PLACEHOLDER')}
      />
      {hasSendMessageError && (
        <p className="auth-card__error" role="alert">
          {t(
            isInvalidMessageError
              ? 'PROFILE_MESSAGES_ERROR_INVALID'
              : 'PROFILE_MESSAGES_ERROR_STORAGE'
          )}
        </p>
      )}
      <ComposerActions>
        <Button
          type="button"
          variation="secondary"
          disabled={!content || isSendingMessage}
          onClick={() => {
            onContentChange('')
            onCancelReply?.()
          }}
        >
          {t('ACTION_CANCEL')}
        </Button>
        <Button type="submit" variation="primary" disabled={!canSubmitMessage || isSendingMessage}>
          {isSendingMessage ? t('AUTH_SUBMITTING') : t('PROFILE_MESSAGES_SEND')}
        </Button>
      </ComposerActions>
    </form>
  )
}
