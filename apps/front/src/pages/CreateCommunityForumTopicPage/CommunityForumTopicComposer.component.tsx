import type { FormEvent } from 'react'

import { RichTextEditor } from '@/Components'
import { Button, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import type { CommunityForumTopicComposerProps } from './CommunityForumTopicComposer.types'

export function CommunityForumTopicComposer({
  title,
  onTitleChange,
  content,
  onContentChange,
  canSubmit,
  isSubmitting,
  hasError,
  onSubmit,
  onUploadImage
}: CommunityForumTopicComposerProps) {
  const { t } = useTranslations()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    void onSubmit(event)
  }

  return (
    <form className="community-forum__composer" onSubmit={handleSubmit}>
      <div className="form-field">
        <Label htmlFor="forum-topic-title">
          {t('FORUM_TOPIC_TITLE')}
        </Label>
        <input
          id="forum-topic-title"
          className="input"
          value={title}
          maxLength={140}
          onChange={(event) => onTitleChange(event.target.value)}
          required
        />
      </div>
      <div className="form-field">
        <Label
          id="forum-topic-content-label"
          htmlFor="forum-topic-content"
        >
          {t('FORUM_TOPIC_CONTENT')}
        </Label>
        <RichTextEditor
          id="forum-topic-content"
          value={content}
          onChange={onContentChange}
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
      <Button type="submit" disabled={!canSubmit || isSubmitting}>
        {t('FORUM_PUBLISH_TOPIC')}
      </Button>
    </form>
  )
}
