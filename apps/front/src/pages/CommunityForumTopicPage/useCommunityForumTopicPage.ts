import { type FormEvent, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'

import { hasRichTextContent } from '@/Components/Molecules/RichTextEditor'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import {
  useCreateCommunityForumReplyMutation,
  useDeleteCommunityForumReplyMutation,
  useDeleteCommunityForumTopicMutation,
  useModerateCommunityForumTopicMutation
} from '@/Hooks/CommunityForum'
import { getCommunityForumTopicPage } from '@/Services/CommunityForum'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import { uploadEditorImage } from '@/Services/Uploads'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'

import type { UseCommunityForumTopicPageResult } from './useCommunityForumTopicPage.types'

export function useCommunityForumTopicPage(): UseCommunityForumTopicPageResult {
  const { url, topicId } = useParams<{ url: string; topicId: string }>()
  const { t } = useTranslations()
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const viewerUserId = session?.user.id ?? null
  const currentProfileId = session?.user.currentProfile ?? null
  const showToast = useToastStore((state) => state.showToast)
  const normalized = normalizeEntityUrl(url)
  const { page, pageSize, setPage } = useUrlPagination()
  const [replyContent, setReplyContent] = useState('')

  const topicPageQuery = useQuery({
    queryKey: queryKeys.communityForumTopicPage(
      normalized,
      topicId ?? '',
      page,
      pageSize,
      viewerUserId,
      currentProfileId
    ),
    queryFn: () =>
      getCommunityForumTopicPage(normalized, topicId!, { page, pageSize }),
    enabled: Boolean(normalized && topicId && isAuthInitialized),
    staleTime: 30 * 1000
  })
  const pageData = topicPageQuery.data
  const community = pageData?.community
  const detail = pageData?.detail
  const topic = detail?.topic
  const forumProfileId = pageData?.forumProfileId ?? null
  const viewerRelationship = pageData?.viewerRelationship ?? null
  const isMember = pageData?.isMember ?? false
  const isStaff = pageData?.isStaff ?? false
  const currentProfileType = pageData?.currentProfileType ?? null
  const isChecking = Boolean(currentProfileId && topicPageQuery.isLoading)
  const isCompatible =
    !currentProfileId ||
    (topicPageQuery.isSuccess && currentProfileType === (community?.type ?? 'social'))
  const typeCompatibility = {
    isChecking,
    isCompatible,
    canInteract: !session || (isCompatible && !isChecking)
  }
  const canInteract = isMember && typeCompatibility.canInteract && !isChecking
  const authorsById = useMemo(
    () =>
      new Map(
        (pageData?.authors ?? []).map(
          (profile) => [profile.id, profile] as const
        )
      ),
    [pageData?.authors]
  )

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

  const replyMutation = useCreateCommunityForumReplyMutation()
  const moderationMutation = useModerateCommunityForumTopicMutation()
  const deleteTopicMutation = useDeleteCommunityForumTopicMutation()
  const deleteReplyMutation = useDeleteCommunityForumReplyMutation()

  const togglePinned = () => {
    if (!topic || !community || !forumProfileId) return
    moderationMutation.mutate(
      {
        communityId: community.id,
        topicId: topic.id,
        profileId: forumProfileId,
        changes: { isPinned: !topic.isPinned }
      },
      {
        onSuccess: () => showToast(t('TOAST_FORUM_TOPIC_UPDATED')),
        onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
      }
    )
  }
  const toggleLocked = () => {
    if (!topic || !community || !forumProfileId) return
    moderationMutation.mutate(
      {
        communityId: community.id,
        topicId: topic.id,
        profileId: forumProfileId,
        changes: { isLocked: !topic.isLocked }
      },
      {
        onSuccess: () => showToast(t('TOAST_FORUM_TOPIC_UPDATED')),
        onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
      }
    )
  }
  const deleteTopic = () => {
    if (!community || !topic || !forumProfileId) return
    deleteTopicMutation.mutate(
      {
        communityId: community.id,
        topicId: topic.id,
        profileId: forumProfileId
      },
      {
        onSuccess: () => {
          showToast(t('TOAST_FORUM_CONTENT_DELETED'))
          navigate(`${ROUTES.community}/${community.url}/forum`, { replace: true })
        },
        onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
      }
    )
  }
  const deleteReply = (replyId: string) => {
    if (!community || !forumProfileId) return
    deleteReplyMutation.mutate(
      { communityId: community.id, replyId, profileId: forumProfileId },
      {
        onSuccess: () => showToast(t('TOAST_FORUM_CONTENT_DELETED')),
        onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
      }
    )
  }

  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      !hasRichTextContent(replyContent) ||
      !isMember ||
      !canInteract ||
      topic?.isLocked
    ) return
    if (!community || !topic || !forumProfileId) return

    try {
      await replyMutation.mutateAsync({
        communityId: community.id,
        topicId: topic.id,
        profileId: forumProfileId,
        content: replyContent
      })
      setReplyContent('')
      showToast(t('TOAST_FORUM_REPLY_CREATED'))
    } catch {
      showToast(t('TOAST_ACTION_FAILED'), 'error')
    }
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
    topicPageQuery,
    community,
    viewerRelationship,
    typeCompatibility,
    isMember,
    isStaff,
    canInteract,
    detail,
    topic,
    topicAuthor,
    canDeleteTopic,
    replyItems,
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
