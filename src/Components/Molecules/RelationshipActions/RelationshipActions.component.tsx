import { Link } from 'react-router'

import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useAuthStore } from '@/Stores/Auth.store'
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
  const relationship = useRelationshipStore((state) =>
    sourceId
      ? state.relationships.find(
          (item) =>
            item.profiles.includes(sourceId) &&
            item.profiles.includes(targetId)
        ) ?? null
      : null
  )
  const updateRelationship = useRelationshipStore(
    (state) => state.updateRelationship
  )
  const removeRelationship = useRelationshipStore(
    (state) => state.removeRelationship
  )

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
    session.user.profiles.includes(targetId)
  ) {
    return null
  }

  const handleAddOrAccept = () => {
    updateRelationship(
      sourceId,
      targetId,
      relationship?.type === 'requested' ? 'connection' : 'requested'
    )
  }

  const handleBlock = () => {
    updateRelationship(sourceId, targetId, 'blocked')
  }

  const handleRemoveOrUnblock = () => {
    removeRelationship(sourceId, targetId)
  }

  const isCommunity = targetKind === 'community'

  return (
    <div className="account-card__relationship-actions">
      {relationship?.type === 'connection' ? (
        <Button variation="secondary" onClick={handleRemoveOrUnblock}>
          {t(isCommunity ? 'COMMUNITY_LEAVE' : 'RELATIONSHIP_REMOVE')}
        </Button>
      ) : relationship?.type === 'requested' ? (
        <Button variation="secondary" onClick={handleAddOrAccept}>
          {t(isCommunity ? 'COMMUNITY_ACCEPT' : 'RELATIONSHIP_ACCEPT')}
        </Button>
      ) : relationship?.type === 'blocked' ? (
        <Button variation="secondary" onClick={handleRemoveOrUnblock}>
          {t(isCommunity ? 'COMMUNITY_UNBLOCK' : 'RELATIONSHIP_UNBLOCK')}
        </Button>
      ) : (
        <Button onClick={handleAddOrAccept}>
          {t(isCommunity ? 'COMMUNITY_JOIN' : 'RELATIONSHIP_ADD')}
        </Button>
      )}

      {relationship?.type !== 'blocked' && (
        <Button variation="cancel" onClick={handleBlock}>
          {t(isCommunity ? 'COMMUNITY_BLOCK' : 'RELATIONSHIP_BLOCK')}
        </Button>
      )}

      {relationship?.type === 'requested' && (
        <span className="account-card__description">
          {t('RELATIONSHIP_PENDING')}
        </span>
      )}
    </div>
  )
}
