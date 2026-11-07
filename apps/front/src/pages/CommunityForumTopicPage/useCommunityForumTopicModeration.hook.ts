import { useNavigate } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import {
  useDeleteCommunityForumReplyMutation,
  useDeleteCommunityForumTopicMutation,
  useModerateCommunityForumTopicMutation
} from '@/Hooks/CommunityForum'
import { useToastStore } from '@/Stores/Toast.store'
import type {
  UseCommunityForumTopicModerationOptions,
  UseCommunityForumTopicModerationResult
} from './useCommunityForumTopicModeration.types'

export function useCommunityForumTopicModeration({
  community,
  topic,
  forumProfileId,
  canInteract,
  isStaff
}: UseCommunityForumTopicModerationOptions): UseCommunityForumTopicModerationResult {
  const navigate = useNavigate()
  const { t } = useTranslations()
  const showToast = useToastStore((state) => state.showToast)
  const moderationMutation = useModerateCommunityForumTopicMutation()
  const deleteTopicMutation = useDeleteCommunityForumTopicMutation()
  const deleteReplyMutation = useDeleteCommunityForumReplyMutation()

  const canDeleteTopic = Boolean(
    canInteract &&
    forumProfileId &&
    topic &&
    (topic.profileId === forumProfileId || isStaff)
  )

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
          navigate(`${ROUTES.community}/${community.url}/forum`, {
            replace: true
          })
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

  return {
    canDeleteTopic,
    isUpdatingTopic: moderationMutation.isPending,
    isDeletingTopic: deleteTopicMutation.isPending,
    isDeletingReply: deleteReplyMutation.isPending,
    togglePinned,
    toggleLocked,
    deleteTopic,
    deleteReply
  }
}
