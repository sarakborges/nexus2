import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'

import { type FormEvent, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { hasRichTextContent } from '@/Components/Molecules/RichTextEditor/richText.utils'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { uploadEditorImage } from '@/Services/Uploads'
import { getCommunityByUrl } from '@/Services/Community'
import { createCommunityForumTopic } from '@/Services/CommunityForum'
import { getCommunityRelationships } from '@/Services/CommunityRelationship'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import type { UseCreateCommunityForumTopicPageResult } from './useCreateCommunityForumTopicPage.types'

export function useCreateCommunityForumTopicPage(): UseCreateCommunityForumTopicPageResult {
  const { t } = useTranslations()
  const { url } = useParams<{ url: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAuthStore((state) => state.session)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const profileIds = session?.user.profiles ?? []
  const currentProfileId = session?.user.currentProfile ?? null
  const showToast = useToastStore((state) => state.showToast)
  const normalized = normalizeEntityUrl(url)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const communityQuery = useQuery({
    queryKey: queryKeys.communities.byUrl(normalized, session?.user.id ?? null),
    queryFn: () => getCommunityByUrl(normalized),
    enabled: Boolean(normalized)
  })
  const community = communityQuery.data
  const relationshipsQuery = useQuery({
    queryKey: queryKeys.communityRelationships(
      community?.id ?? '',
      session?.user.id ?? null
    ),
    queryFn: () => getCommunityRelationships(community!.id),
    enabled: Boolean(community?.id && session?.user.id)
  })
  const ownedProfilesQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(profileIds),
    queryFn: () => getProfilesByIds(profileIds),
    enabled: profileIds.length > 0
  })
  const rolesByProfileId = new Map(
    (relationshipsQuery.data ?? [])
      .filter((record) => record.profiles[1] === community?.id)
      .map((record) => [record.profiles[0], record.type] as const)
  )
  const eligibleProfiles = (ownedProfilesQuery.data ?? []).filter(
    (profile) =>
      profile.type === community?.type &&
      ['owner', 'moderator', 'connection'].includes(
        rolesByProfileId.get(profile.id) ?? ''
      )
  )
  const forumProfile =
    eligibleProfiles.find((profile) => profile.id === currentProfileId) ??
    eligibleProfiles.find(
      (profile) => rolesByProfileId.get(profile.id) === 'owner'
    ) ??
    eligibleProfiles.find(
      (profile) => rolesByProfileId.get(profile.id) === 'moderator'
    ) ??
    eligibleProfiles[0] ??
    null

  const createMutation = useMutation({
    mutationFn: () =>
      createCommunityForumTopic(
        community!.id,
        forumProfile!.id,
        title,
        content
      ),
    onSuccess: async (topic) => {
      showToast(t('TOAST_FORUM_TOPIC_CREATED'))
      await queryClient.invalidateQueries({
        queryKey: ['community-forum', community?.id]
      })
      navigate(ROUTES.community + '/' + community!.url + '/forum/' + topic.id, {
        replace: true
      })
    },
    onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
  })
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !hasRichTextContent(content) || !forumProfile) return
    await createMutation.mutateAsync()
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
