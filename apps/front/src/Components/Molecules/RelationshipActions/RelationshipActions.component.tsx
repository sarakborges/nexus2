import type { CommunityRelationshipType, RelationshipType } from '@nexus/common'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useState } from 'react'
import { Link } from 'react-router'

import { RequestState } from '@/Components/Molecules/RequestState'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import {
  getCommunityRelationships,
  removeCommunityRelationship,
  setCommunityRelationship
} from '@/Services/CommunityRelationship'
import { queryKeys } from '@/Services/Query/queryKeys'
import {
  getRelationships,
  removeRelationship,
  setRelationship
} from '@/Services/Relationship'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'

type RelationshipActionsProps = {
  targetId: string
  targetKind?: 'profile' | 'community'
}
type Action = { type: 'remove' } | { type: RelationshipType }

export function RelationshipActions({
  targetId,
  targetKind = 'profile'
}: RelationshipActionsProps) {
  const { t } = useTranslations()
  const queryClient = useQueryClient()
  const session = useAuthStore((state) => state.session)
  const sourceId = session?.user.currentProfile ?? null
  const showToast = useToastStore((state) => state.showToast)
  const isCommunity = targetKind === 'community'
  const canQuery = Boolean(
    session &&
    sourceId &&
    (isCommunity || !session.user.profiles.includes(targetId))
  )
  const relationshipsQuery = useQuery({
    queryKey: isCommunity
      ? queryKeys.communityRelationships(targetId, session?.user.id ?? null)
      : queryKeys.relationships.byProfile(sourceId ?? ''),
    queryFn: () =>
      isCommunity
        ? getCommunityRelationships(targetId)
        : getRelationships(sourceId!),
    enabled: canQuery
  })
  const relationship = isCommunity
    ? (relationshipsQuery.data?.find(
        (item) => item.profiles[0] === sourceId && item.profiles[1] === targetId
      ) ?? null)
    : (relationshipsQuery.data?.find(
        (item) =>
          item.profiles.includes(sourceId ?? '') &&
          item.profiles.includes(targetId)
      ) ?? null)
  const [lastAction, setLastAction] = useState<Action | null>(null)
  const mutation = useMutation({
    mutationFn: async (action: Action) => {
      if (!sourceId) throw new Error('SOURCE_PROFILE_REQUIRED')
      if (action.type === 'remove') {
        if (isCommunity)
          await removeCommunityRelationship(sourceId, targetId, sourceId)
        else await removeRelationship(sourceId, targetId)
        return
      }
      if (isCommunity) {
        await setCommunityRelationship(
          sourceId,
          targetId,
          action.type as CommunityRelationshipType,
          sourceId
        )
        return
      }
      await setRelationship(sourceId, targetId, action.type as RelationshipType)
    },
    onSuccess: async (_data, action) => {
      const toastKey =
        action.type === 'remove'
          ? isCommunity
            ? 'TOAST_COMMUNITY_LEFT'
            : 'TOAST_RELATIONSHIP_REMOVED'
          : action.type === 'requested'
            ? isCommunity
              ? 'TOAST_COMMUNITY_JOINED'
              : 'TOAST_RELATIONSHIP_REQUESTED'
            : action.type === 'blocked'
              ? 'TOAST_RELATIONSHIP_BLOCKED'
              : action.type === 'connection'
                ? isCommunity
                  ? 'TOAST_COMMUNITY_ACCEPTED'
                  : 'TOAST_RELATIONSHIP_CONNECTED'
                : 'TOAST_COMMUNITY_MODERATION'
      showToast(t(toastKey))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['relationships'] }),
        queryClient.invalidateQueries({ queryKey: ['community-relationships'] })
      ])
    },
    onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
  })
  const run = (action: Action) => {
    setLastAction(action)
    mutation.mutate(action)
  }

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
  )
    return null
  if (relationshipsQuery.isLoading) return <RequestState isLoading />
  if (relationshipsQuery.isError)
    return (
      <RequestState isError onRetry={() => void relationshipsQuery.refetch()} />
    )

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
      if (isIncomingRequest) run({ type: 'connection' })
      else if (isOwnRequest) run({ type: 'remove' })
      return
    }
    run({ type: 'requested' })
  }

  if (isCommunity && (isOwner || isModerator)) return null
  if (isBlockedByOther)
    return (
      <p className="account-card__description">
        {t('RELATIONSHIP_BLOCKED_BY_OTHER')}
      </p>
    )

  return (
    <div className="account-card__relationship-actions">
      <RequestState isFetching={relationshipsQuery.isFetching} />
      {mutation.isError && (
        <RequestState
          isError
          onRetry={lastAction ? () => mutation.mutate(lastAction) : undefined}
        />
      )}
      {isLegacyBlock ? (
        <>
          <span className="account-card__description">
            {t('RELATIONSHIP_LEGACY_BLOCKED')}
          </span>
          <Button
            variation="secondary"
            disabled={mutation.isPending}
            onClick={() => run({ type: 'remove' })}
          >
            {t('RELATIONSHIP_CLEAR_LEGACY')}
          </Button>
        </>
      ) : relationship?.type === 'connection' ? (
        <Button
          variation="secondary"
          disabled={mutation.isPending}
          onClick={() => run({ type: 'remove' })}
        >
          {t(isCommunity ? 'COMMUNITY_LEAVE' : 'RELATIONSHIP_REMOVE')}
        </Button>
      ) : isBlockedByCurrent ? (
        isCommunity ? (
          <>
            <span className="account-card__description">
              {t('RELATIONSHIP_LEGACY_BLOCKED')}
            </span>
            <Button
              variation="secondary"
              disabled={mutation.isPending}
              onClick={() => run({ type: 'remove' })}
            >
              {t('RELATIONSHIP_CLEAR_LEGACY')}
            </Button>
          </>
        ) : (
          <Button
            variation="secondary"
            disabled={mutation.isPending}
            onClick={() => run({ type: 'remove' })}
          >
            {t('RELATIONSHIP_UNBLOCK')}
          </Button>
        )
      ) : isIncomingRequest ? (
        <Button
          variation="secondary"
          disabled={mutation.isPending}
          onClick={handleRequestOrAccept}
        >
          {t(isCommunity ? 'COMMUNITY_ACCEPT' : 'RELATIONSHIP_ACCEPT')}
        </Button>
      ) : isOwnRequest ? (
        <Button
          variation="secondary"
          disabled={mutation.isPending}
          onClick={handleRequestOrAccept}
        >
          {t('RELATIONSHIP_CANCEL_REQUEST')}
        </Button>
      ) : isLegacyRequest ? (
        <Button
          variation="secondary"
          disabled={mutation.isPending}
          onClick={() => run({ type: 'remove' })}
        >
          {t('RELATIONSHIP_CLEAR_LEGACY')}
        </Button>
      ) : (
        <Button disabled={mutation.isPending} onClick={handleRequestOrAccept}>
          {t(isCommunity ? 'COMMUNITY_JOIN' : 'RELATIONSHIP_ADD')}
        </Button>
      )}
      {!isCommunity && relationship?.type !== 'blocked' && (
        <Button
          variation="cancel"
          disabled={mutation.isPending}
          onClick={() => run({ type: 'blocked' })}
        >
          {t('RELATIONSHIP_BLOCK')}
        </Button>
      )}
    </div>
  )
}
