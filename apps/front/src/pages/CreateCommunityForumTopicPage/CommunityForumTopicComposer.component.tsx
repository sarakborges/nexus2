import { ComposerActions, RichTextComposerField } from '@/Components'
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
  onCancel,
  onUploadImage
}: CommunityForumTopicComposerProps) {
  const { t } = useTranslations()

  return (
    <form className="community-forum__composer" onSubmit={onSubmit}>
      <FormField
        id="forum-topic-title"
        label={t('FORUM_TOPIC_TITLE')}
        type="text"
        value={title}
        maxLength={140}
        onChange={(event) => onTitleChange(event.target.value)}
        required
      />
      <RichTextComposerField
        id="forum-topic-content"
        label={t('FORUM_TOPIC_CONTENT')}
        value={content}
        onChange={onContentChange}
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
          disabled={isSubmitting || (!title && !content)}
          onClick={onCancel}
        >
          {t('ACTION_CANCEL')}
        </Button>
        <Button type="submit" variation="primary" disabled={!canSubmit || isSubmitting}>
          {t('FORUM_PUBLISH_TOPIC')}
        </Button>
      </ComposerActions>
    </form>
  )
}
