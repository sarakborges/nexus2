import { type FormEvent, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'

import { useCreateCommunityForumTopicMutation } from '@/Hooks/CommunityForum'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'
import { hasRichTextContent } from '@/Components/Molecules/RichTextEditor/richText.utils'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getCommunityForumComposerPage } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'
import { uploadEditorImage } from '@/Services/Uploads'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import type { UseCreateCommunityForumTopicPageResult } from './useCreateCommunityForumTopicPage.types'

export function useCreateCommunityForumTopicPage(): UseCreateCommunityForumTopicPageResult {
  const { t } = useTranslations()
  const { url } = useParams<{ url: string }>()
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const currentProfileId = session?.user.currentProfile ?? null
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const viewerUserId = session?.user.id ?? null
  const showToast = useToastStore((state) => state.showToast)
  const normalized = normalizeEntityUrl(url)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const composerPageQuery = useQuery({
    queryKey: queryKeys.communityForumComposerPage(
      normalized,
      viewerUserId,
      currentProfileId
    ),
    queryFn: () => getCommunityForumComposerPage(normalized),
    enabled: Boolean(normalized && isAuthInitialized),
    staleTime: 30 * 1000
  })
  const community = composerPageQuery.data?.community
  const forumProfile = composerPageQuery.data?.forumProfile ?? null
  const viewerRelationship = composerPageQuery.data?.viewerRelationship ?? null
  const currentProfileType = composerPageQuery.data?.currentProfileType ?? null
  const isChecking = Boolean(currentProfileId && composerPageQuery.isLoading)
  const isCompatible =
    !currentProfileId ||
    (composerPageQuery.isSuccess && currentProfileType === (community?.type ?? 'social'))
  const typeCompatibility = {
    isChecking,
    isCompatible,
    canInteract: !session || (isCompatible && !isChecking)
  }
  const canPublish = Boolean(forumProfile && typeCompatibility.canInteract && !isChecking)
  const createMutation = useCreateCommunityForumTopicMutation()

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      !canPublish ||
      !title.trim() ||
      !hasRichTextContent(content) ||
      content.length > 8000 ||
      !community ||
      !forumProfile
    ) return

    try {
      const topic = await createMutation.mutateAsync({
        communityId: community.id,
        profileId: forumProfile.id,
        title,
        content
      })
      showToast(t('TOAST_FORUM_TOPIC_CREATED'))
      navigate(ROUTES.community + '/' + community.url + '/forum/' + topic.id, {
        replace: true
      })
    } catch {
      showToast(t('TOAST_ACTION_FAILED'), 'error')
    }
  }

  return {
    normalized,
    session,
    isAuthInitialized,
    composerPageQuery,
    community,
    forumProfile,
    viewerRelationship,
    typeCompatibility,
    canPublish,
    title,
    setTitle,
    content,
    setContent,
    createMutation,
    submit,
    canSubmit: Boolean(canPublish && title.trim() && hasRichTextContent(content) && content.length <= 8000),
    uploadEditorImage
  }
}
