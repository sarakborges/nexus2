import type { CommunityRelationshipType, RelationshipType } from '@nexus/common'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useState } from 'react'

import type {
  RelationshipAction,
  RelationshipActionsController,
  RelationshipActionsProps
} from './RelationshipActions.types'
import { useTranslations } from '@/Hooks/Language'
import {
  getCommunityRelationships,
  removeCommunityRelationship,
  setCommunityRelationship
} from '@/Services/CommunityRelationship'
import { queryKeys } from '@/Services/Query/queryKeys'
import {
  getRelationships,
  removeRelationship,
  setRelationship
} from '@/Services/Relationship'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'

export function useRelationshipActions({
  targetId,
  targetKind = 'profile'
}: RelationshipActionsProps): RelationshipActionsController {
  const { t } = useTranslations()
  const queryClient = useQueryClient()
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
    queryFn: () =>
      isCommunity
        ? getCommunityRelationships(targetId)
        : getRelationships(sourceId!),
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
  const mutation = useMutation({
    mutationFn: async (action: RelationshipAction) => {
      if (!sourceId) throw new Error('SOURCE_PROFILE_REQUIRED')
      if (action.type === 'remove') {
        if (isCommunity) {
          await removeCommunityRelationship(sourceId, targetId, sourceId)
        } else {
          await removeRelationship(sourceId, targetId)
        }
        return
      }
      if (isCommunity) {
        await setCommunityRelationship(
          sourceId,
          targetId,
          action.type as CommunityRelationshipType,
          sourceId
        )
        return
      }
      await setRelationship(sourceId, targetId, action.type as RelationshipType)
    },
    onSuccess: async (_data, action) => {
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

      showToast(t(toastKey))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['relationships'] }),
        queryClient.invalidateQueries({ queryKey: ['community-relationships'] })
      ])
    },
    onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
  })

  const run = (action: RelationshipAction) => {
    setLastAction(action)
    mutation.mutate(action)
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
    isMutationPending: mutation.isPending,
    isMutationError: mutation.isError,
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
      ? () => mutation.mutate(lastAction)
      : undefined
  }
}
