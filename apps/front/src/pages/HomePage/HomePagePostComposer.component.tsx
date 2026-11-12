import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Profile } from '@nexus/common'

import { RichTextEditor } from '@/Components'
import { Button, Label } from '@/DesignSystem'
import { hasRichTextContent } from '@/Components/Molecules/RichTextEditor/richText.utils'
import { useTranslations } from '@/Hooks/Language'
import { createProfilePost } from '@/Services/Home'
import { queryKeys } from '@/Services/Query/queryKeys'
import { uploadEditorImage } from '@/Services/Uploads'
import { useToastStore } from '@/Stores/Toast.store'

type HomePagePostComposerProps = {
  currentProfile: Profile
}

export function HomePagePostComposer({ currentProfile }: HomePagePostComposerProps) {
  const { t } = useTranslations()
  const showToast = useToastStore(state => state.showToast)
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')

  const mutation = useMutation({
    mutationFn: () => createProfilePost(currentProfile.id, content),
    onSuccess: async () => {
      setContent('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session })
      showToast(t('HOME_POST_PUBLISHED'))
    },
    onError: () => showToast(t('HOME_POST_FAILED'), 'error')
  })

  const canSubmit = hasRichTextContent(content) && content.length <= 8000

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || mutation.isPending) return
    mutation.mutate()
  }

  return (
    <form className="home-page__post-composer" onSubmit={handleSubmit}>
      <div className="form-field">
        <Label id="home-post-content-label" htmlFor="home-post-content">
          {t('HOME_POST_COMPOSE_LABEL')}
        </Label>
        <RichTextEditor
          id="home-post-content"
          value={content}
          onChange={setContent}
          maxHtmlLength={8000}
          imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
          imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
          onUploadImage={uploadEditorImage}
          placeholder={t('RICH_TEXT_PLACEHOLDER')}
        />
      </div>
      {mutation.isError && (
        <p className="home-page__post-error" role="alert">{t('HOME_POST_FAILED')}</p>
      )}
      <div className="home-page__post-composer-actions">
        <Button type="submit" variation="primary" disabled={!canSubmit || mutation.isPending}>
          {mutation.isPending ? t('HOME_POST_PUBLISHING') : t('HOME_POST_PUBLISH')}
        </Button>
      </div>
    </form>
  )
}
