import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { hasRichTextContent } from '@/Components/Molecules/RichTextEditor/richText.utils'
import { useTranslations } from '@/Hooks/Language'
import { createProfilePost } from '@/Services/Home'
import { queryKeys } from '@/Services/Query/queryKeys'
import { uploadEditorImage } from '@/Services/Uploads'
import { useToastStore } from '@/Stores/Toast.store'
import type { HomePagePostComposerProps, UseHomePagePostComposerResult } from './HomePagePostComposer.types'

export function useHomePagePostComposer({
  currentProfile
}: HomePagePostComposerProps): UseHomePagePostComposerResult {
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

  return {
    content,
    setContent,
    canSubmit,
    isSubmitting: mutation.isPending,
    hasError: mutation.isError,
    handleSubmit,
    uploadEditorImage
  }
}
