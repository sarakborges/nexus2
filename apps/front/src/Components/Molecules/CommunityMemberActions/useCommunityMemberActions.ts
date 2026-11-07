import type {
  CommunityMemberActionsController,
  CommunityMemberOperation,
  UseCommunityMemberActionsOptions
} from './useCommunityMemberActions.types'
import { useState } from 'react'

import { useCommunityRelationshipMutation } from '@/Hooks/CommunityRelationship'
import { useTranslations } from '@/Hooks/Language'
import { useToastStore } from '@/Stores/Toast.store'

export function useCommunityMemberActions({
  memberProfileId,
  communityId,
  actorProfileId
}: UseCommunityMemberActionsOptions): CommunityMemberActionsController {
  const { t } = useTranslations()
  const showToast = useToastStore((state) => state.showToast)
  const [confirmTransfer, setConfirmTransfer] = useState(false)
  const [lastOperation, setLastOperation] =
    useState<CommunityMemberOperation | null>(null)

  const mutation = useCommunityRelationshipMutation()

  const run = (operation: CommunityMemberOperation) => {
    setLastOperation(operation)
    mutation.mutate(
      {
        memberProfileId,
        communityId,
        actorProfileId,
        operation
      },
      {
        onSuccess: () => {
          showToast(t('TOAST_COMMUNITY_MODERATION'))
          setConfirmTransfer(false)
        },
        onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
      }
    )
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
