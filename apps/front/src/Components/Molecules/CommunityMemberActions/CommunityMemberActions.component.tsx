import type {
  CommunityMemberActionsProps,
  CommunityMemberOperation
} from './CommunityMemberActions.types'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useState } from 'react'

import { RequestState } from '@/Components/Molecules/RequestState'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import {
  demoteCommunityModerator,
  removeCommunityRelationship,
  setCommunityRelationship,
  transferCommunityOwnership
} from '@/Services/CommunityRelationship'
import { useToastStore } from '@/Stores/Toast.store'

export function CommunityMemberActions({
  memberProfileId,
  communityId,
  actorProfileId,
  actorRole,
  relationship
}: CommunityMemberActionsProps) {
  const { t } = useTranslations()
  const queryClient = useQueryClient()
  const showToast = useToastStore((state) => state.showToast)
  const [confirmTransfer, setConfirmTransfer] = useState(false)
  const [lastOperation, setLastOperation] = useState<CommunityMemberOperation | null>(null)
  const mutation = useMutation({
    mutationFn: async (operation: CommunityMemberOperation) => {
      if (operation.type === 'remove')
        return removeCommunityRelationship(
          memberProfileId,
          communityId,
          actorProfileId
        )
      if (operation.type === 'demote')
        return demoteCommunityModerator(
          memberProfileId,
          communityId,
          actorProfileId
        )
      if (operation.type === 'transfer')
        return transferCommunityOwnership(
          actorProfileId,
          memberProfileId,
          communityId
        )
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
  const pending = mutation.isPending

  if (!relationship || relationship.type === 'owner') return null

  return (
    <div className="account-card__relationship-actions">
      {mutation.isError && (
        <RequestState
          isError
          onRetry={
            lastOperation ? () => mutation.mutate(lastOperation) : undefined
          }
        />
      )}
      {relationship.type === 'blocked' ? (
        <Button
          variation="secondary"
          disabled={pending}
          onClick={() => run({ type: 'remove' })}
        >
          {t('COMMUNITY_UNBAN_MEMBER')}
        </Button>
      ) : relationship.type === 'requested' ? (
        <>
          <Button
            disabled={pending}
            onClick={() =>
              run({ type: 'update', relationshipType: 'connection' })
            }
          >
            {t('COMMUNITY_ACCEPT_REQUEST')}
          </Button>
          <Button
            variation="secondary"
            disabled={pending}
            onClick={() => run({ type: 'remove' })}
          >
            {t('COMMUNITY_REJECT_REQUEST')}
          </Button>
        </>
      ) : relationship.type === 'moderator' ? (
        actorRole === 'owner' ? (
          <>
            <Button
              variation="secondary"
              disabled={pending}
              onClick={() => run({ type: 'demote' })}
            >
              {t('COMMUNITY_DEMOTE_MODERATOR')}
            </Button>
            {confirmTransfer ? (
              <>
                <Button
                  disabled={pending}
                  onClick={() => run({ type: 'transfer' })}
                >
                  {t('COMMUNITY_CONFIRM_TRANSFER')}
                </Button>
                <Button
                  variation="secondary"
                  disabled={pending}
                  onClick={() => setConfirmTransfer(false)}
                >
                  {t('COMMUNITY_CANCEL_TRANSFER')}
                </Button>
              </>
            ) : (
              <Button
                variation="secondary"
                disabled={pending}
                onClick={() => setConfirmTransfer(true)}
              >
                {t('COMMUNITY_TRANSFER_OWNERSHIP')}
              </Button>
            )}
          </>
        ) : null
      ) : (
        <>
          {actorRole === 'owner' && (
            <Button
              variation="secondary"
              disabled={pending}
              onClick={() =>
                run({ type: 'update', relationshipType: 'moderator' })
              }
            >
              {t('COMMUNITY_PROMOTE_MODERATOR')}
            </Button>
          )}
          <Button
            variation="cancel"
            disabled={pending}
            onClick={() => run({ type: 'update', relationshipType: 'blocked' })}
          >
            {t('COMMUNITY_BAN_MEMBER')}
          </Button>
        </>
      )}
    </div>
  )
}
