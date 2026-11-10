import { Link } from 'react-router'

import { RelationshipActions, RequestState, RichTextEditor } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { Button, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import type { CommunityForumReplyComposerProps } from './CommunityForumReplyComposer.types'

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
  onUploadImage
}: CommunityForumReplyComposerProps) {
  const { t } = useTranslations()

  return (
    <section className="account-card community-forum community-forum__reply-composer-card">
      {isLoading || isError ? (
        <RequestState
          isLoading={isLoading}
          isError={isError}
          onRetry={onRetry}
        />
      ) : canReply ? (
        <form
          className="community-forum__reply-composer"
          onSubmit={onSubmit}
        >
          <div className="form-field">
            <Label
              id="forum-reply-content-label"
              htmlFor="forum-reply-content"
            >
              {t('FORUM_REPLY')}
            </Label>
            <RichTextEditor
              id="forum-reply-content"
              value={value}
              onChange={onChange}
              maxHtmlLength={8000}
              imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
              imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
              onUploadImage={onUploadImage}
              placeholder={t('RICH_TEXT_PLACEHOLDER')}
            />
          </div>
          {hasError && (
            <p className="auth-card__error" role="alert">
              {t('FORUM_TOPIC_ERROR')}
            </p>
          )}
          <Button type="submit" disabled={!canSubmit || isSending}>
            {t('FORUM_PUBLISH_REPLY')}
          </Button>
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
