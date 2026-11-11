import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'

import { hasRichTextContent } from '@/Components/Molecules/RichTextEditor'
import { useTranslations } from '@/Hooks/Language'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useCreateCommunityForumReplyMutation } from '@/Hooks/CommunityForum'
import { getCommunityForumTopicPage } from '@/Services/CommunityForum'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import { uploadEditorImage } from '@/Services/Uploads'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'
import { subscribeToCommunityForumTopic } from '@/Services/Realtime'

import { useCommunityForumTopicModeration } from './useCommunityForumTopicModeration.hook'
import type { UseCommunityForumTopicPageResult } from './useCommunityForumTopicPage.types'

export function useCommunityForumTopicPage(): UseCommunityForumTopicPageResult {
  const { url, topicId } = useParams<{ url: string; topicId: string }>()
  const { t } = useTranslations()
  const session = useAuthStore((state) => state.session)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const viewerUserId = session?.user.id ?? null
  const currentProfileId = session?.user.currentProfile ?? null
  const showToast = useToastStore((state) => state.showToast)
  const normalized = normalizeEntityUrl(url)
  const { page, pageSize, setPage, query, sort, setQuery, setSort } = useUrlPagination('page', 'activity-asc')
  const [replyContent, setReplyContent] = useState('')

  const topicPageQuery = useQuery({
    queryKey: queryKeys.communityForumTopicPage(
      normalized,
      topicId ?? '',
      page,
      pageSize,
      viewerUserId,
      currentProfileId,
      query,
      sort
    ),
    queryFn: () =>
      getCommunityForumTopicPage(normalized, topicId!, { page, pageSize, query, sort }),
    enabled: Boolean(normalized && topicId && isAuthInitialized),
    staleTime: 30 * 1000
  })
  useEffect(() => {
    if (!topicId || !topicPageQuery.isSuccess) return

    return subscribeToCommunityForumTopic(topicId, () => {
      void topicPageQuery.refetch()
    })
  }, [topicId, topicPageQuery.isSuccess, topicPageQuery.refetch])

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
  const {
    canDeleteTopic,
    isUpdatingTopic,
    isDeletingTopic,
    isDeletingReply,
    togglePinned,
    toggleLocked,
    deleteTopic,
    deleteReply
  } = useCommunityForumTopicModeration({
    community,
    topic,
    forumProfileId,
    canInteract,
    isStaff
  })

  const replyMutation = useCreateCommunityForumReplyMutation()

  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      !hasRichTextContent(replyContent) ||
      replyContent.length > 8000 ||
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
    query,
    sort,
    setQuery,
    setSort,
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
    canSubmitReply: hasRichTextContent(replyContent) && replyContent.length <= 8000,
    isSendingReply: replyMutation.isPending,
    isUpdatingTopic,
    isDeletingTopic,
    isDeletingReply,
    togglePinned,
    toggleLocked,
    deleteTopic,
    deleteReply,
    submitReply,
    uploadEditorImage
  }
}
