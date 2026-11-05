import { useRelationshipActions } from './useRelationshipActions'

import { RequestState } from '@/Components/Molecules/RequestState'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'

type RelationshipActionsViewProps = {
  targetId: string
  targetKind?: 'profile' | 'community'
}

export function RelationshipActions({
  targetId,
  targetKind = 'profile'
}: RelationshipActionsViewProps) {
  const { t } = useTranslations()
  const actions = useRelationshipActions({ targetId, targetKind })

  if (!actions.isAuthenticated) {
    return (
      <p className="account-card__description">
        <a href="/sign-in">{t('RELATIONSHIP_SIGN_IN')}</a>
      </p>
    )
  }
  if (!actions.canInteract) return null
  if (actions.isLoading) return <RequestState isLoading />
  if (actions.isQueryError) {
    return <RequestState isError onRetry={actions.refetch} />
  }
  if (actions.isCommunity && actions.isOwnerOrModerator) return null
  if (actions.isBlockedByOther) {
    return (
      <p className="account-card__description">
        {t('RELATIONSHIP_BLOCKED_BY_OTHER')}
      </p>
    )
  }

  return (
    <div className="account-card__relationship-actions">
      <RequestState isFetching={actions.isFetching} />
      {actions.isMutationError && (
        <RequestState isError onRetry={actions.retryLastAction} />
      )}
      {actions.isLegacyBlock ? (
        <>
          <span className="account-card__description">
            {t('RELATIONSHIP_LEGACY_BLOCKED')}
          </span>
          <Button
            variation="secondary"
            disabled={actions.isMutationPending}
            onClick={() => actions.run({ type: 'remove' })}
          >
            {t('RELATIONSHIP_CLEAR_LEGACY')}
          </Button>
        </>
      ) : actions.isConnection ? (
        <Button
          variation="secondary"
          disabled={actions.isMutationPending}
          onClick={() => actions.run({ type: 'remove' })}
        >
          {t(actions.isCommunity ? 'COMMUNITY_LEAVE' : 'RELATIONSHIP_REMOVE')}
        </Button>
      ) : actions.isBlockedByCurrent ? (
        actions.isCommunity ? (
          <>
            <span className="account-card__description">
              {t('RELATIONSHIP_LEGACY_BLOCKED')}
            </span>
            <Button
              variation="secondary"
              disabled={actions.isMutationPending}
              onClick={() => actions.run({ type: 'remove' })}
            >
              {t('RELATIONSHIP_CLEAR_LEGACY')}
            </Button>
          </>
        ) : (
          <Button
            variation="secondary"
            disabled={actions.isMutationPending}
            onClick={() => actions.run({ type: 'remove' })}
          >
            {t('RELATIONSHIP_UNBLOCK')}
          </Button>
        )
      ) : actions.isIncomingRequest ? (
        <Button
          variation="secondary"
          disabled={actions.isMutationPending}
          onClick={actions.handleRequestOrAccept}
        >
          {t(actions.isCommunity ? 'COMMUNITY_ACCEPT' : 'RELATIONSHIP_ACCEPT')}
        </Button>
      ) : actions.isOwnRequest ? (
        <Button
          variation="secondary"
          disabled={actions.isMutationPending}
          onClick={actions.handleRequestOrAccept}
        >
          {t('RELATIONSHIP_CANCEL_REQUEST')}
        </Button>
      ) : actions.isLegacyRequest ? (
        <Button
          variation="secondary"
          disabled={actions.isMutationPending}
          onClick={() => actions.run({ type: 'remove' })}
        >
          {t('RELATIONSHIP_CLEAR_LEGACY')}
        </Button>
      ) : (
        <Button
          disabled={actions.isMutationPending}
          onClick={actions.handleRequestOrAccept}
        >
          {t(actions.isCommunity ? 'COMMUNITY_JOIN' : 'RELATIONSHIP_ADD')}
        </Button>
      )}
      {actions.canBlock && (
        <Button
          variation="cancel"
          disabled={actions.isMutationPending}
          onClick={() => actions.run({ type: 'blocked' })}
        >
          {t('RELATIONSHIP_BLOCK')}
        </Button>
      )}
    </div>
  )
}
