import { Link } from 'react-router'

import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useAuthStore } from '@/Stores/Auth.store'
import { useCommunityRelationshipStore } from '@/Stores/CommunityRelationship.store'
import { useRelationshipStore } from '@/Stores/Relationship.store'

type RelationshipActionsProps = {
  targetId: string
  targetKind?: 'profile' | 'community'
}

export function RelationshipActions({
  targetId,
  targetKind = 'profile'
}: RelationshipActionsProps) {
  const { t } = useTranslations()
  const session = useAuthStore((state) => state.session)
  const sourceId = session?.user.currentProfile ?? null
  const isCommunity = targetKind === 'community'

  const profileRelationship = useRelationshipStore((state) =>
    !isCommunity && sourceId
      ? state.getRelationship(sourceId, targetId)
      : null
  )
  const communityRelationship = useCommunityRelationshipStore((state) =>
    isCommunity && sourceId
      ? state.getRelationship(sourceId, targetId)
      : null
  )
  const updateProfileRelationship = useRelationshipStore(
    (state) => state.updateRelationship
  )
  const removeProfileRelationship = useRelationshipStore(
    (state) => state.removeRelationship
  )
  const updateCommunityRelationship = useCommunityRelationshipStore(
    (state) => state.updateRelationship
  )
  const removeCommunityRelationship = useCommunityRelationshipStore(
    (state) => state.removeRelationship
  )
  const relationship = isCommunity
    ? communityRelationship
    : profileRelationship

  if (!session) {
    return (
      <p className="account-card__description">
        <Link to="/sign-in">{t('RELATIONSHIP_SIGN_IN')}</Link>
      </p>
    )
  }

  if (
    !sourceId ||
    sourceId === targetId ||
    (!isCommunity && session.user.profiles.includes(targetId))
  ) {
    return null
  }

  const remove = () => {
    if (isCommunity) {
      removeCommunityRelationship(sourceId, targetId, sourceId)
    } else {
      removeProfileRelationship(sourceId, targetId)
    }
  }

  const update = (type: 'connection' | 'requested' | 'blocked') => {
    if (isCommunity) {
      updateCommunityRelationship(sourceId, targetId, type, sourceId)
    } else {
      updateProfileRelationship(sourceId, targetId, type, sourceId)
    }
  }

  const isOwner = relationship?.type === 'owner'
  const isModerator = relationship?.type === 'moderator'
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
      if (isIncomingRequest) {
        update('connection')
      } else if (isOwnRequest) {
        remove()
      }
      return
    }

    update('requested')
  }

  const handleBlock = () => update('blocked')

  if (isCommunity && isOwner) {
    return (
      <p className="account-card__description">
        {t('COMMUNITY_ROLE_OWNER')}
      </p>
    )
  }

  if (isCommunity && isModerator) {
    return (
      <p className="account-card__description">
        {t('COMMUNITY_ROLE_MODERATOR')}
      </p>
    )
  }

  if (isBlockedByOther) {
    return (
      <p className="account-card__description">
        {t('RELATIONSHIP_BLOCKED_BY_OTHER')}
      </p>
    )
  }

  if (isLegacyBlock) {
    return (
      <div className="account-card__relationship-actions">
        <span className="account-card__description">
          {t('RELATIONSHIP_LEGACY_BLOCKED')}
        </span>
        <Button variation="secondary" onClick={remove}>
          {t('RELATIONSHIP_CLEAR_LEGACY')}
        </Button>
      </div>
    )
  }

  return (
    <div className="account-card__relationship-actions">
      {relationship?.type === 'connection' ? (
        <Button variation="secondary" onClick={remove}>
          {t(isCommunity ? 'COMMUNITY_LEAVE' : 'RELATIONSHIP_REMOVE')}
        </Button>
      ) : isBlockedByCurrent ? (
        <Button variation="secondary" onClick={remove}>
          {t(isCommunity ? 'COMMUNITY_UNBLOCK' : 'RELATIONSHIP_UNBLOCK')}
        </Button>
      ) : isIncomingRequest ? (
        <Button variation="secondary" onClick={handleRequestOrAccept}>
          {t(isCommunity ? 'COMMUNITY_ACCEPT' : 'RELATIONSHIP_ACCEPT')}
        </Button>
      ) : isOwnRequest ? (
        <Button variation="secondary" onClick={handleRequestOrAccept}>
          {t('RELATIONSHIP_CANCEL_REQUEST')}
        </Button>
      ) : isLegacyRequest ? (
        <Button variation="secondary" onClick={remove}>
          {t('RELATIONSHIP_CLEAR_LEGACY')}
        </Button>
      ) : (
        <Button onClick={handleRequestOrAccept}>
          {t(isCommunity ? 'COMMUNITY_JOIN' : 'RELATIONSHIP_ADD')}
        </Button>
      )}

      {relationship?.type !== 'blocked' && (
        <Button variation="cancel" onClick={handleBlock}>
          {t(isCommunity ? 'COMMUNITY_BLOCK' : 'RELATIONSHIP_BLOCK')}
        </Button>
      )}
    </div>
  )
}
