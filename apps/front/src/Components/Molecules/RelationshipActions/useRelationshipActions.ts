import { useQuery } from '@tanstack/react-query'

import { useState } from 'react'

import type {
  RelationshipActionsController,
  UseRelationshipActionsOptions
} from './useRelationshipActions.types'
import { useRelationshipMutation } from '@/Hooks/Relationship'
import { useCommunityRelationshipMutation } from '@/Hooks/CommunityRelationship'
import { useTranslations } from '@/Hooks/Language'
import { getCommunityRelationships } from '@/Services/CommunityRelationship'
import { queryKeys } from '@/Services/Query/queryKeys'
import { getRelationships } from '@/Services/Relationship'
import { useAuthStore } from '@/Stores/Auth.store'
import type { RelationshipAction } from './useRelationshipActions.types'
import { useToastStore } from '@/Stores/Toast.store'

export function useRelationshipActions({
  targetId,
  targetKind = 'profile'
}: UseRelationshipActionsOptions): RelationshipActionsController {
  const { t } = useTranslations()
  const session = useAuthStore((state) => state.session)
  const sourceId = session?.user.currentProfile ?? null
  const showToast = useToastStore((state) => state.showToast)
  const isCommunity = targetKind === 'community'
  const canQuery = Boolean(
    session &&
    sourceId &&
    (isCommunity || !session.user.profiles.includes(targetId))
  )
  const canInteract = Boolean(
    sourceId &&
    sourceId !== targetId &&
    (isCommunity || !session?.user.profiles.includes(targetId))
  )

  const relationshipsQuery = useQuery({
    queryKey: isCommunity
      ? queryKeys.communityRelationships(targetId, session?.user.id ?? null)
      : queryKeys.relationships.byProfile(sourceId ?? ''),
    queryFn: () => {
      if (!sourceId) throw new Error('SOURCE_PROFILE_REQUIRED')

      return isCommunity
        ? getCommunityRelationships(targetId)
        : getRelationships(sourceId)
    },
    enabled: canQuery
  })

  const relationship = isCommunity
    ? (relationshipsQuery.data?.find(
        (item) => item.profiles[0] === sourceId && item.profiles[1] === targetId
      ) ?? null)
    : (relationshipsQuery.data?.find(
        (item) =>
          item.profiles.includes(sourceId ?? '') &&
          item.profiles.includes(targetId)
      ) ?? null)

  const [lastAction, setLastAction] = useState<RelationshipAction | null>(null)
  const relationshipMutation = useRelationshipMutation()
  const communityRelationshipMutation = useCommunityRelationshipMutation()
  const isMutationPending = isCommunity
    ? communityRelationshipMutation.isPending
    : relationshipMutation.isPending
  const isMutationError = isCommunity
    ? communityRelationshipMutation.isError
    : relationshipMutation.isError

  const run = (action: RelationshipAction) => {
    if (!sourceId) return
    setLastAction(action)

    const toastKey =
      action.type === 'remove'
        ? isCommunity
          ? 'TOAST_COMMUNITY_LEFT'
          : 'TOAST_RELATIONSHIP_REMOVED'
        : action.type === 'requested'
          ? isCommunity
            ? 'TOAST_COMMUNITY_JOINED'
            : 'TOAST_RELATIONSHIP_REQUESTED'
          : action.type === 'blocked'
            ? 'TOAST_RELATIONSHIP_BLOCKED'
            : action.type === 'connection'
              ? isCommunity
                ? 'TOAST_COMMUNITY_ACCEPTED'
                : 'TOAST_RELATIONSHIP_CONNECTED'
              : 'TOAST_COMMUNITY_MODERATION'
    const callbacks = {
      onSuccess: () => showToast(t(toastKey)),
      onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
    }

    if (isCommunity) {
      communityRelationshipMutation.mutate(
        {
          profileId: sourceId,
          communityId: targetId,
          actorProfileId: sourceId,
          operation:
            action.type === 'remove'
              ? { type: 'remove' }
              : { type: 'update', relationshipType: action.type }
        },
        callbacks
      )
      return
    }

    relationshipMutation.mutate(
      { sourceProfileId: sourceId, targetProfileId: targetId, action },
      callbacks
    )
  }

  const isOwnerOrModerator =
    relationship?.type === 'owner' || relationship?.type === 'moderator'
  const isBlockedByCurrent = relationship?.blockedBy === sourceId
  const isBlockedByOther =
    relationship?.type === 'blocked' &&
    relationship.blockedBy !== null &&
    !isBlockedByCurrent
  const isLegacyBlock =
    relationship?.type === 'blocked' && relationship.blockedBy === null
  const isOwnRequest = relationship?.requestedBy === sourceId
  const isIncomingRequest =
    relationship?.type === 'requested' &&
    relationship.requestedBy !== null &&
    !isOwnRequest
  const isLegacyRequest =
    relationship?.type === 'requested' && relationship.requestedBy === null

  const handleRequestOrAccept = () => {
    if (relationship?.type === 'requested') {
      if (isIncomingRequest) run({ type: 'connection' })
      else if (isOwnRequest) run({ type: 'remove' })
      return
    }
    run({ type: 'requested' })
  }

  return {
    isAuthenticated: Boolean(session),
    canInteract,
    isCommunity,
    isLoading: relationshipsQuery.isLoading,
    isFetching: relationshipsQuery.isFetching,
    isQueryError: relationshipsQuery.isError,
    isMutationPending,
    isMutationError,
    isOwnerOrModerator: Boolean(isOwnerOrModerator),
    isBlockedByOther,
    isLegacyBlock,
    isConnection: relationship?.type === 'connection',
    isBlockedByCurrent,
    isIncomingRequest,
    isOwnRequest,
    isLegacyRequest,
    canBlock: !isCommunity && relationship?.type !== 'blocked',
    run,
    handleRequestOrAccept,
    refetch: () => void relationshipsQuery.refetch(),
    retryLastAction: lastAction
      ? () => run(lastAction)
      : undefined
  }
}
