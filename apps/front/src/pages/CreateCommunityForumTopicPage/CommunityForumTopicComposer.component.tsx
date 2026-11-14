import type { FormEvent } from 'react'

import { RichTextEditor } from '@/Components'
import { Button, FormField } from '@/DesignSystem'
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
      <FormField
        id="forum-topic-title"
        label={t('FORUM_TOPIC_TITLE')}
        type="text"
        value={title}
        maxLength={140}
        onChange={(event) => onTitleChange(event.target.value)}
        required
      />
      <div className="form-field">
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
