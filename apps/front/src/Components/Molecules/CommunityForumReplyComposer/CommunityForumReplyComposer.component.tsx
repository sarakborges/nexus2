import { Link } from 'react-router'

import { ComposerActions, RelationshipActions, RequestState, RichTextComposerField } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import type { CommunityForumReplyComposerProps } from './CommunityForumReplyComposer.types'
import './CommunityForumReplyComposer.style.scss'

export function CommunityForumReplyComposer({
  isLoading,
  isError,
  onRetry,
  canReply,
  hasSession,
  isMember,
  isTopicLocked,
  communityId,
  value,
  canSubmit,
  isSending,
  hasError,
  onChange,
  onSubmit,
  onCancel,
  onUploadImage
}: CommunityForumReplyComposerProps) {
  const { t } = useTranslations()

  return (
    <section className="account-card community-forum community-forum-reply-composer__card">
      {isLoading || isError ? (
        <RequestState
          isLoading={isLoading}
          isError={isError}
          onRetry={onRetry}
        />
      ) : canReply ? (
        <form
          className="community-forum-reply-composer"
          onSubmit={onSubmit}
        >
          <RichTextComposerField
            id="forum-reply-content"
            label={t('FORUM_REPLY')}
            value={value}
            onChange={onChange}
            maxHtmlLength={8000}
            imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
            imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
            onUploadImage={onUploadImage}
            placeholder={t('RICH_TEXT_PLACEHOLDER')}
          />
          {hasError && (
            <p className="auth-card__error" role="alert">
              {t('FORUM_TOPIC_ERROR')}
            </p>
          )}
          <ComposerActions>
            <Button
              type="button"
              variation="secondary"
              disabled={!value || isSending}
              onClick={onCancel}
            >
              {t('ACTION_CANCEL')}
            </Button>
            <Button type="submit" variation="primary" disabled={!canSubmit || isSending}>
              {t('FORUM_PUBLISH_REPLY')}
            </Button>
          </ComposerActions>
        </form>
      ) : (
        <div className="community-forum__join">
          <p className="account-card__description">
            {isTopicLocked ? t('FORUM_LOCKED') : t('FORUM_MEMBERS_ONLY')}
          </p>
          {!hasSession && (
            <Link to={ROUTES.signIn}>{t('AUTH_SIGN_IN_LINK')}</Link>
          )}
          {hasSession && !isMember && (
            <RelationshipActions
              targetId={communityId}
              targetKind="community"
            />
          )}
        </div>
      )}
    </section>
  )
}
