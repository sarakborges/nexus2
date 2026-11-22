import { FormErrorMessage } from '@/Components/Atoms/FormErrorMessage'
import { Link } from 'react-router'

import { ComposerActions } from '@/Components/Molecules/ComposerActions'
import { RichTextComposerField } from '@/Components/Organisms/RichTextComposerField'
import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import type { ProfileMessageComposerProps } from './ProfileMessageComposer.types'
import type { ProfileMessageErrorCode } from '@/Services/ProfileMessage'
import type { TranslationKey } from '@/Types/Translation.type'

import './ProfileMessageComposer.style.scss'

const ERROR_TRANSLATIONS = {
  INVALID_MESSAGE: 'PROFILE_MESSAGES_ERROR_INVALID',
  ACCOUNT_NOT_FOUND: 'PROFILE_MESSAGES_ERROR_ACCOUNT',
  PROFILE_MESSAGE_FRIENDS_ONLY: 'PROFILE_MESSAGES_ERROR_FRIENDS_ONLY',
  PROFILE_TYPE_MISMATCH: 'PROFILE_MESSAGES_ERROR_PROFILE_TYPE',
  PROFILE_NOT_OWNED: 'PROFILE_MESSAGES_ERROR_PROFILE_ACCESS',
  PROFILE_NOT_FOUND: 'PROFILE_MESSAGES_ERROR_PROFILE_NOT_FOUND',
  INVALID_EDITOR_IMAGE: 'PROFILE_MESSAGES_ERROR_IMAGE',
  EDITOR_IMAGE_ALREADY_ATTACHED: 'PROFILE_MESSAGES_ERROR_IMAGE',
  STORAGE_UNAVAILABLE: 'PROFILE_MESSAGES_ERROR_STORAGE'
} as const satisfies Record<ProfileMessageErrorCode, TranslationKey>

export function ProfileMessageComposer({
  hasSession,
  isProfileOwner,
  canSendMessage,
  content,
  onContentChange,
  canSubmitMessage,
  isSendingMessage,
  hasSendMessageError,
  sendMessageErrorCode,
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
        <FormErrorMessage>
          {t(ERROR_TRANSLATIONS[sendMessageErrorCode ?? 'STORAGE_UNAVAILABLE'])}
        </FormErrorMessage>
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
