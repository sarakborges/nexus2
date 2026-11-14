import type { RelationshipActionsProps } from './RelationshipActions.types'
import { useRelationshipActions } from './useRelationshipActions'

import { Link } from 'react-router'

import { RequestState } from '@/Components/Molecules/RequestState'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'

type RelationshipAction = {
  label: string
  variation: 'primary' | 'secondary' | 'cancel'
  run: () => void
}

export function RelationshipActions({
  targetId,
  targetKind = 'profile',
  relationship,
  className,
  buttonClassName
}: RelationshipActionsProps) {
  const { t } = useTranslations()
  const actions = useRelationshipActions({ targetId, targetKind, relationship })

  if (!actions.isAuthenticated) {
    return (
      <div className={['account-card__relationship-actions', className].filter(Boolean).join(' ')}>
        <p className="account-card__description">
          <Link to="/sign-in">{t('RELATIONSHIP_SIGN_IN')}</Link>
        </p>
      </div>
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

  let primaryAction: RelationshipAction
  let contextMessage: string | null = null

  if (actions.isLegacyBlock) {
    contextMessage = 'RELATIONSHIP_LEGACY_BLOCKED'
    primaryAction = {
      label: 'RELATIONSHIP_CLEAR_LEGACY',
      variation: 'secondary',
      run: () => actions.run({ type: 'remove' })
    }
  } else if (actions.isConnection) {
    primaryAction = {
      label: actions.isCommunity ? 'COMMUNITY_LEAVE' : 'RELATIONSHIP_REMOVE',
      variation: 'secondary',
      run: () => actions.run({ type: 'remove' })
    }
  } else if (actions.isBlockedByCurrent) {
    if (actions.isCommunity) contextMessage = 'RELATIONSHIP_LEGACY_BLOCKED'
    primaryAction = {
      label: actions.isCommunity ? 'RELATIONSHIP_CLEAR_LEGACY' : 'RELATIONSHIP_UNBLOCK',
      variation: 'secondary',
      run: () => actions.run({ type: 'remove' })
    }
  } else if (actions.isIncomingRequest) {
    primaryAction = {
      label: actions.isCommunity ? 'COMMUNITY_ACCEPT' : 'RELATIONSHIP_ACCEPT',
      variation: 'secondary',
      run: actions.handleRequestOrAccept
    }
  } else if (actions.isOwnRequest) {
    primaryAction = {
      label: 'RELATIONSHIP_CANCEL_REQUEST',
      variation: 'secondary',
      run: actions.handleRequestOrAccept
    }
  } else if (actions.isLegacyRequest) {
    primaryAction = {
      label: 'RELATIONSHIP_CLEAR_LEGACY',
      variation: 'secondary',
      run: () => actions.run({ type: 'remove' })
    }
  } else {
    primaryAction = {
      label: actions.isCommunity ? 'COMMUNITY_JOIN' : 'RELATIONSHIP_ADD',
      variation: 'primary',
      run: actions.handleRequestOrAccept
    }
  }

  return (
    <div className={['account-card__relationship-actions', className].filter(Boolean).join(' ')}>
      <RequestState isFetching={actions.isFetching} />
      {actions.isMutationError && (
        <RequestState isError onRetry={actions.retryLastAction} />
      )}
      {contextMessage && (
        <span className="account-card__description">{t(contextMessage)}</span>
      )}
      <Button
        className={buttonClassName}
        variation={primaryAction.variation}
        disabled={actions.isMutationPending}
        onClick={primaryAction.run}
      >
        {t(primaryAction.label)}
      </Button>
      {actions.canBlock && (
        <Button
          className={buttonClassName}
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
