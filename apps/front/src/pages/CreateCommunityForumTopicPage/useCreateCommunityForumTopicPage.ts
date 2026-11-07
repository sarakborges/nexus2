import { useState } from 'react'

import { type FormEvent, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useCommunityByUrl, useCommunityForumAccess } from '@/Hooks/Community'
import { useCreateCommunityForumTopicMutation } from '@/Hooks/CommunityForum'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'

import { hasRichTextContent } from '@/Components/Molecules/RichTextEditor/richText.utils'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { uploadEditorImage } from '@/Services/Uploads'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import type { UseCreateCommunityForumTopicPageResult } from './useCreateCommunityForumTopicPage.types'

export function useCreateCommunityForumTopicPage(): UseCreateCommunityForumTopicPageResult {
  const { t } = useTranslations()
  const { url } = useParams<{ url: string }>()
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const profileIds = session?.user.profiles ?? []
  const currentProfileId = session?.user.currentProfile ?? null
  const showToast = useToastStore((state) => state.showToast)
  const normalized = normalizeEntityUrl(url)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const communityQuery = useCommunityByUrl({
    url: normalized,
    viewerUserId: session?.user.id ?? null
  })
  const community = communityQuery.data
  const {
    relationshipsQuery,
    ownedProfilesQuery,
    forumProfile
  } = useCommunityForumAccess({
    communityId: community?.id ?? null,
    communityType: community?.type ?? null,
    viewerUserId: session?.user.id ?? null,
    profileIds,
    currentProfileId,
    relationshipsEnabled: Boolean(session?.user.id)
  })

  const createMutation = useCreateCommunityForumTopicMutation()
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !hasRichTextContent(content) || !community || !forumProfile) return

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
    communityQuery,
    community,
    relationshipsQuery,
    ownedProfilesQuery,
    forumProfile,
    title,
    setTitle,
    content,
    setContent,
    createMutation,
    submit,
    canSubmit: Boolean(title.trim() && hasRichTextContent(content)),
    uploadEditorImage
  }
}
