import { useState } from 'react'

import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useCommunityRelationshipStore } from '@/Stores/CommunityRelationship.store'

type CommunityMemberActionsProps = {
  memberProfileId: string
  communityId: string
  actorProfileId: string
  actorRole: 'owner' | 'moderator'
}

export function CommunityMemberActions({
  memberProfileId,
  communityId,
  actorProfileId,
  actorRole
}: CommunityMemberActionsProps) {
  const { t } = useTranslations()
  const [confirmTransfer, setConfirmTransfer] = useState(false)
  const relationship = useCommunityRelationshipStore((state) =>
    state.getRelationship(memberProfileId, communityId)
  )
  const updateRelationship = useCommunityRelationshipStore(
    (state) => state.updateRelationship
  )
  const removeRelationship = useCommunityRelationshipStore(
    (state) => state.removeRelationship
  )
  const demoteModerator = useCommunityRelationshipStore(
    (state) => state.demoteModerator
  )
  const transferOwnership = useCommunityRelationshipStore(
    (state) => state.transferOwnership
  )

  if (!relationship || relationship.type === 'owner') {
    return null
  }

  const remove = () =>
    removeRelationship(memberProfileId, communityId, actorProfileId)

  const ban = () =>
    updateRelationship(
      memberProfileId,
      communityId,
      'blocked',
      actorProfileId
    )

  if (relationship.type === 'blocked') {
    return (
      <Button variation="secondary" onClick={remove}>
        {t('COMMUNITY_UNBAN_MEMBER')}
      </Button>
    )
  }

  if (relationship.type === 'requested') {
    return (
      <div className="account-card__relationship-actions">
        <Button
          onClick={() =>
            updateRelationship(
              memberProfileId,
              communityId,
              'connection',
              actorProfileId
            )
          }
        >
          {t('COMMUNITY_ACCEPT_REQUEST')}
        </Button>
        <Button variation="secondary" onClick={remove}>
          {t('COMMUNITY_REJECT_REQUEST')}
        </Button>
      </div>
    )
  }

  if (relationship.type === 'moderator') {
    if (actorRole !== 'owner') {
      return null
    }

    return (
      <div className="account-card__relationship-actions">
        <Button
          variation="secondary"
          onClick={() =>
            demoteModerator(memberProfileId, communityId, actorProfileId)
          }
        >
          {t('COMMUNITY_DEMOTE_MODERATOR')}
        </Button>
        {confirmTransfer ? (
          <>
            <Button
              onClick={() => {
                if (
                  transferOwnership(
                    actorProfileId,
                    memberProfileId,
                    communityId
                  )
                ) {
                  setConfirmTransfer(false)
                }
              }}
            >
              {t('COMMUNITY_CONFIRM_TRANSFER')}
            </Button>
            <Button
              variation="secondary"
              onClick={() => setConfirmTransfer(false)}
            >
              {t('COMMUNITY_CANCEL_TRANSFER')}
            </Button>
          </>
        ) : (
          <Button
            variation="secondary"
            onClick={() => setConfirmTransfer(true)}
          >
            {t('COMMUNITY_TRANSFER_OWNERSHIP')}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="account-card__relationship-actions">
      {actorRole === 'owner' && (
        <Button
          variation="secondary"
          onClick={() =>
            updateRelationship(
              memberProfileId,
              communityId,
              'moderator',
              actorProfileId
            )
          }
        >
          {t('COMMUNITY_PROMOTE_MODERATOR')}
        </Button>
      )}
      <Button variation="cancel" onClick={ban}>
        {t('COMMUNITY_BAN_MEMBER')}
      </Button>
    </div>
  )
}
