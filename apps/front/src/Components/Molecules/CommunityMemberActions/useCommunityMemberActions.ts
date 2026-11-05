import type { UseCommunityMemberActionsOptions } from './useCommunityMemberActions.types'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useState } from 'react'

import type {
  CommunityMemberActionsController,
  CommunityMemberOperation
} from './CommunityMemberActions.types'
import { useTranslations } from '@/Hooks/Language'
import {
  demoteCommunityModerator,
  removeCommunityRelationship,
  setCommunityRelationship,
  transferCommunityOwnership
} from '@/Services/CommunityRelationship'
import { useToastStore } from '@/Stores/Toast.store'

export function useCommunityMemberActions({
  memberProfileId,
  communityId,
  actorProfileId
}: UseCommunityMemberActionsOptions): CommunityMemberActionsController {
  const { t } = useTranslations()
  const queryClient = useQueryClient()
  const showToast = useToastStore((state) => state.showToast)
  const [confirmTransfer, setConfirmTransfer] = useState(false)
  const [lastOperation, setLastOperation] =
    useState<CommunityMemberOperation | null>(null)

  const mutation = useMutation({
    mutationFn: async (operation: CommunityMemberOperation) => {
      if (operation.type === 'remove') {
        return removeCommunityRelationship(
          memberProfileId,
          communityId,
          actorProfileId
        )
      }
      if (operation.type === 'demote') {
        return demoteCommunityModerator(
          memberProfileId,
          communityId,
          actorProfileId
        )
      }
      if (operation.type === 'transfer') {
        return transferCommunityOwnership(
          actorProfileId,
          memberProfileId,
          communityId
        )
      }
      return setCommunityRelationship(
        memberProfileId,
        communityId,
        operation.relationshipType,
        actorProfileId
      )
    },
    onSuccess: async () => {
      showToast(t('TOAST_COMMUNITY_MODERATION'))
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['community-relationships', communityId]
        }),
        queryClient.invalidateQueries({
          queryKey: ['community-members', communityId]
        })
      ])
      setConfirmTransfer(false)
    },
    onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
  })

  const run = (operation: CommunityMemberOperation) => {
    setLastOperation(operation)
    mutation.mutate(operation)
  }

  return {
    confirmTransfer,
    pending: mutation.isPending,
    hasError: mutation.isError,
    retryLastOperation: lastOperation
      ? () => mutation.mutate(lastOperation)
      : undefined,
    run,
    confirmOwnershipTransfer: () => setConfirmTransfer(true),
    cancelOwnershipTransfer: () => setConfirmTransfer(false)
  }
}
