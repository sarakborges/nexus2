import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useCommunityRelationshipStore } from '@/Stores/CommunityRelationship.store'

type CommunityMemberActionsProps = {
  memberProfileId: string
  communityId: string
  ownerProfileId: string
}

export function CommunityMemberActions({
  memberProfileId,
  communityId,
  ownerProfileId
}: CommunityMemberActionsProps) {
  const { t } = useTranslations()
  const relationship = useCommunityRelationshipStore((state) =>
    state.getRelationship(memberProfileId, communityId)
  )
  const updateRelationship = useCommunityRelationshipStore(
    (state) => state.updateRelationship
  )
  const removeRelationship = useCommunityRelationshipStore(
    (state) => state.removeRelationship
  )

  if (!relationship || relationship.type === 'owner') {
    return null
  }

  const remove = () =>
    removeRelationship(memberProfileId, communityId, ownerProfileId)

  const block = () =>
    updateRelationship(
      memberProfileId,
      communityId,
      'blocked',
      ownerProfileId
    )

  const unblock = () => remove()

  if (relationship.type === 'blocked') {
    if (relationship.blockedBy !== ownerProfileId) {
      return (
        <span className="account-card__description">
          {t('RELATIONSHIP_BLOCKED_BY_OTHER')}
        </span>
      )
    }

    return (
      <Button variation="secondary" onClick={unblock}>
        {t('COMMUNITY_UNBLOCK_MEMBER')}
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
              ownerProfileId
            )
          }
        >
          {t('COMMUNITY_ACCEPT_REQUEST')}
        </Button>
        <Button variation="secondary" onClick={remove}>
          {t('COMMUNITY_REJECT_REQUEST')}
        </Button>
        <Button variation="cancel" onClick={block}>
          {t('COMMUNITY_BLOCK_MEMBER')}
        </Button>
      </div>
    )
  }

  return (
    <div className="account-card__relationship-actions">
      <Button variation="secondary" onClick={remove}>
        {t('COMMUNITY_REMOVE_MEMBER')}
      </Button>
      <Button variation="cancel" onClick={block}>
        {t('COMMUNITY_BLOCK_MEMBER')}
      </Button>
    </div>
  )
}
