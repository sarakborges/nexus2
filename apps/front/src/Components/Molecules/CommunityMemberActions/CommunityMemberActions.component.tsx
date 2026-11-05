import type { CommunityMemberActionsProps } from './CommunityMemberActions.types'
import { useCommunityMemberActions } from './useCommunityMemberActions'

import { RequestState } from '@/Components/Molecules/RequestState'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'

export function CommunityMemberActions({
  memberProfileId,
  communityId,
  actorProfileId,
  actorRole,
  relationship
}: CommunityMemberActionsProps) {
  const { t } = useTranslations()
  const {
    confirmTransfer,
    pending,
    hasError,
    retryLastOperation,
    run,
    confirmOwnershipTransfer,
    cancelOwnershipTransfer
  } = useCommunityMemberActions({
    memberProfileId,
    communityId,
    actorProfileId
  })

  if (!relationship || relationship.type === 'owner') return null

  return (
    <div className="account-card__relationship-actions">
      {hasError && (
        <RequestState isError onRetry={retryLastOperation} />
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
                  onClick={cancelOwnershipTransfer}
                >
                  {t('COMMUNITY_CANCEL_TRANSFER')}
                </Button>
              </>
            ) : (
              <Button
                variation="secondary"
                disabled={pending}
                onClick={confirmOwnershipTransfer}
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
