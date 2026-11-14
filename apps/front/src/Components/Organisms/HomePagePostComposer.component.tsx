import { ComposerActions, RichTextComposerField } from '@/Components'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useHomePagePostComposer } from '@/Hooks/Home/useHomePagePostComposer.hook'
import type { HomePagePostComposerProps } from './HomePagePostComposer.types'

export function HomePagePostComposer({ currentProfile }: HomePagePostComposerProps) {
  const { t } = useTranslations()
  const {
    content,
    setContent,
    canSubmit,
    isSubmitting,
    hasError,
    handleSubmit,
    uploadEditorImage
  } = useHomePagePostComposer({ currentProfile })

  return (
    <form className="home-page__post-composer" onSubmit={handleSubmit}>
      <RichTextComposerField
        id="home-post-content"
        label={t('HOME_POST_COMPOSE_LABEL')}
        value={content}
        onChange={setContent}
        maxHtmlLength={8000}
        imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
        imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
        onUploadImage={uploadEditorImage}
        placeholder={t('RICH_TEXT_PLACEHOLDER')}
      />
      {hasError && (
        <p className="home-page__post-error" role="alert">
          {t('HOME_POST_FAILED')}
        </p>
      )}
      <ComposerActions>
        <Button
          type="button"
          variation="secondary"
          disabled={!content || isSubmitting}
          onClick={() => setContent('')}
        >
          {t('ACTION_CANCEL')}
        </Button>
        <Button type="submit" variation="primary" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? t('HOME_POST_PUBLISHING') : t('HOME_POST_PUBLISH')}
        </Button>
      </ComposerActions>
    </form>
  )
}
