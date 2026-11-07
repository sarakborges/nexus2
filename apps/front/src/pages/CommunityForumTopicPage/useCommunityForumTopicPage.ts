import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { type FormEvent, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useCommunityByUrl } from '@/Hooks/Community'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'

import { hasRichTextContent } from '@/Components/Molecules/RichTextEditor'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import {
  createCommunityForumReply,
  deleteCommunityForumReply,
  deleteCommunityForumTopic,
  getCommunityForumTopic,
  moderateCommunityForumTopic
} from '@/Services/CommunityForum'
import { useCommunityForumAccess } from '@/Hooks/Community'
import { useProfileByUrl, useProfilesByIds } from '@/Hooks/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import { uploadEditorImage } from '@/Services/Uploads'

import type {
  CommunityForumTopicModerationChanges,
  UseCommunityForumTopicPageResult
} from './useCommunityForumTopicPage.types'

export function useCommunityForumTopicPage(): UseCommunityForumTopicPageResult {
  const { url, topicId } = useParams<{ url: string; topicId: string }>()
  const { t } = useTranslations()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAuthStore((state) => state.session)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const profileIds = session?.user.profiles ?? []
  const currentProfileId = session?.user.currentProfile ?? null
  const showToast = useToastStore((state) => state.showToast)
  const normalized = normalizeEntityUrl(url)
  const { page, pageSize, setPage } = useUrlPagination()
  const [replyContent, setReplyContent] = useState('')

  const communityQuery = useCommunityByUrl({
    url: normalized,
    viewerUserId: session?.user.id ?? null
  })
  const community = communityQuery.data
  const {
    relationshipsQuery,
    ownedProfilesQuery,
    forumProfileId,
    isMember,
    isStaff
  } = useCommunityForumAccess({
    communityId: community?.id ?? null,
    communityType: community?.type ?? null,
    viewerUserId: session?.user.id ?? null,
    profileIds,
    currentProfileId
  })
  const canInteract = isMember
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
  const {
    profilesQuery: authorsQuery,
    profilesById: authorsById
  } = useProfilesByIds(authorIds)

  const topicAuthor = topic ? authorsById.get(topic.profileId) : undefined
  const canDeleteTopic = Boolean(
    canInteract &&
    forumProfileId &&
    topic &&
    (topic.profileId === forumProfileId || isStaff)
  )
  const replyItems = useMemo(
    () =>
      (detail?.replies.items ?? []).map((reply) => ({
        reply,
        author: authorsById.get(reply.profileId),
        canDelete: Boolean(
          canInteract &&
          forumProfileId &&
          (reply.profileId === forumProfileId || isStaff)
        )
      })),
    [detail?.replies.items, authorsById, canInteract, forumProfileId, isStaff]
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

  const togglePinned = () => {
    if (topic) moderationMutation.mutate({ isPinned: !topic.isPinned })
  }
  const toggleLocked = () => {
    if (topic) moderationMutation.mutate({ isLocked: !topic.isLocked })
  }
  const deleteTopic = () => deleteTopicMutation.mutate()
  const deleteReply = (replyId: string) => deleteReplyMutation.mutate(replyId)

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
    isMember,
    isStaff,
    canInteract,
    topicQuery,
    detail,
    topic,
    topicAuthor,
    canDeleteTopic,
    replyItems,
    authorsQuery,
    hasReplyError: replyMutation.isError,
    canSubmitReply: hasRichTextContent(replyContent),
    isSendingReply: replyMutation.isPending,
    isUpdatingTopic: moderationMutation.isPending,
    isDeletingTopic: deleteTopicMutation.isPending,
    isDeletingReply: deleteReplyMutation.isPending,
    togglePinned,
    toggleLocked,
    deleteTopic,
    deleteReply,
    submitReply,
    uploadEditorImage
  }
}
