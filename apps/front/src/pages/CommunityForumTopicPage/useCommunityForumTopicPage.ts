import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { type FormEvent, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { hasRichTextContent } from '@/Components/Molecules/RichTextEditor'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getCommunityByUrl } from '@/Services/Community'
import {
  createCommunityForumReply,
  deleteCommunityForumReply,
  deleteCommunityForumTopic,
  getCommunityForumTopic,
  moderateCommunityForumTopic
} from '@/Services/CommunityForum'
import { getCommunityRelationships } from '@/Services/CommunityRelationship'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'

import type { CommunityForumTopicModerationChanges } from './useCommunityForumTopicPage.types'

export function useCommunityForumTopicPage() {
  const { url, topicId } = useParams<{ url: string; topicId: string }>()
  const { t } = useTranslations()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAuthStore((state) => state.session)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const profileIds = session?.user.profiles ?? []
  const currentProfileId = session?.user.currentProfile ?? null
  const showToast = useToastStore((state) => state.showToast)
  const normalized = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const { page, pageSize, setPage } = useUrlPagination()
  const [replyContent, setReplyContent] = useState('')

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
    enabled: Boolean(community?.id)
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
  const forumProfileId = forumProfile?.id ?? null
  const currentRole = forumProfileId
    ? (rolesByProfileId.get(forumProfileId) ?? null)
    : null
  const isMember = Boolean(forumProfileId)
  const isStaff = currentRole === 'owner' || currentRole === 'moderator'
  const canInteract = Boolean(forumProfileId)
  const topicQuery = useQuery({
    queryKey: queryKeys.communityForumTopic(
      community?.id ?? '',
      topicId ?? '',
      page,
      pageSize,
      session?.user.id ?? null
    ),
    queryFn: () =>
      getCommunityForumTopic(community!.id, topicId!, { page, pageSize }),
    enabled: Boolean(community?.id && topicId)
  })
  const detail = topicQuery.data
  const topic = detail?.topic
  const replies = detail?.replies.items ?? []
  const authorIds = useMemo(
    () =>
      [
        ...new Set(
          [
            topic?.profileId,
            ...(detail?.replies.items ?? []).map((reply) => reply.profileId)
          ].filter((id): id is string => Boolean(id))
        )
      ].sort(),
    [topic?.profileId, detail?.replies.items]
  )
  const authorsQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(authorIds),
    queryFn: () => getProfilesByIds(authorIds),
    enabled: authorIds.length > 0
  })
  const authorsById = useMemo(
    () =>
      new Map(
        (authorsQuery.data ?? []).map(
          (profile) => [profile.id, profile] as const
        )
      ),
    [authorsQuery.data]
  )

  const replyMutation = useMutation({
    mutationFn: () =>
      createCommunityForumReply(
        community!.id,
        topicId!,
        forumProfileId!,
        replyContent
      ),
    onSuccess: async () => {
      setReplyContent('')
      showToast(t('TOAST_FORUM_REPLY_CREATED'))
      await queryClient.invalidateQueries({
        queryKey: ['community-forum', community?.id]
      })
    },
    onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
  })
  const moderationMutation = useMutation({
    mutationFn: (changes: CommunityForumTopicModerationChanges) =>
      moderateCommunityForumTopic(
        community!.id,
        topicId!,
        forumProfileId!,
        changes
      ),
    onSuccess: async () => {
      showToast(t('TOAST_FORUM_TOPIC_UPDATED'))
      await queryClient.invalidateQueries({
        queryKey: ['community-forum', community?.id]
      })
    },
    onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
  })
  const deleteTopicMutation = useMutation({
    mutationFn: () =>
      deleteCommunityForumTopic(community!.id, topicId!, forumProfileId!),
    onSuccess: async () => {
      showToast(t('TOAST_FORUM_CONTENT_DELETED'))
      await queryClient.invalidateQueries({
        queryKey: ['community-forum', community?.id]
      })
      navigate(`${ROUTES.community}/${community!.url}/forum`, { replace: true })
    },
    onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
  })
  const deleteReplyMutation = useMutation({
    mutationFn: (replyId: string) =>
      deleteCommunityForumReply(community!.id, replyId, forumProfileId!),
    onSuccess: async () => {
      showToast(t('TOAST_FORUM_CONTENT_DELETED'))
      await queryClient.invalidateQueries({
        queryKey: ['community-forum', community?.id]
      })
    },
    onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
  })

  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      !hasRichTextContent(replyContent) ||
      !isMember ||
      !canInteract ||
      topic?.isLocked
    )
      return
    await replyMutation.mutateAsync()
  }


  return {
    topicId,
    t,
    session,
    isAuthInitialized,
    normalized,
    page,
    pageSize,
    setPage,
    replyContent,
    setReplyContent,
    communityQuery,
    community,
    relationshipsQuery,
    ownedProfilesQuery,
    rolesByProfileId,
    eligibleProfiles,
    forumProfile,
    forumProfileId,
    currentRole,
    isMember,
    isStaff,
    canInteract,
    topicQuery,
    detail,
    topic,
    replies,
    authorIds,
    authorsQuery,
    authorsById,
    replyMutation,
    moderationMutation,
    deleteTopicMutation,
    deleteReplyMutation,
    submitReply
  }
}
