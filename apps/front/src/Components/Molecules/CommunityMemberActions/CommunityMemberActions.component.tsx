import { useState } from 'react'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useCommunityRelationshipStore } from '@/Stores/CommunityRelationship.store'

type Props = { memberProfileId: string; communityId: string; actorProfileId: string; actorRole: 'owner' | 'moderator' }
export function CommunityMemberActions({ memberProfileId, communityId, actorProfileId, actorRole }: Props) {
  const { t } = useTranslations()
  const [confirmTransfer, setConfirmTransfer] = useState(false)
  const [pending, setPending] = useState(false)
  const relationship = useCommunityRelationshipStore(state => state.getRelationship(memberProfileId, communityId))
  const updateRelationship = useCommunityRelationshipStore(state => state.updateRelationship)
  const removeRelationship = useCommunityRelationshipStore(state => state.removeRelationship)
  const demoteModerator = useCommunityRelationshipStore(state => state.demoteModerator)
  const transferOwnership = useCommunityRelationshipStore(state => state.transferOwnership)
  if (!relationship || relationship.type === 'owner') return null

  const run = async (action: () => Promise<boolean>) => {
    setPending(true)
    try { await action() } finally { setPending(false) }
  }
  const remove = () => run(() => removeRelationship(memberProfileId, communityId, actorProfileId))
  const ban = () => run(() => updateRelationship(memberProfileId, communityId, 'blocked', actorProfileId))

  if (relationship.type === 'blocked') {
    return <Button variation="secondary" disabled={pending} onClick={() => void remove()}>{t('COMMUNITY_UNBAN_MEMBER')}</Button>
  }
  if (relationship.type === 'requested') {
    return (
      <div className="account-card__relationship-actions">
        <Button disabled={pending} onClick={() => void run(() => updateRelationship(memberProfileId, communityId, 'connection', actorProfileId))}>{t('COMMUNITY_ACCEPT_REQUEST')}</Button>
        <Button variation="secondary" disabled={pending} onClick={() => void remove()}>{t('COMMUNITY_REJECT_REQUEST')}</Button>
      </div>
    )
  }
  if (relationship.type === 'moderator') {
    if (actorRole !== 'owner') return null
    const confirm = async () => {
      setPending(true)
      try {
        const success = await transferOwnership(actorProfileId, memberProfileId, communityId)
        if (success) setConfirmTransfer(false)
      } finally { setPending(false) }
    }
    return (
      <div className="account-card__relationship-actions">
        <Button variation="secondary" disabled={pending} onClick={() => void run(() => demoteModerator(memberProfileId, communityId, actorProfileId))}>{t('COMMUNITY_DEMOTE_MODERATOR')}</Button>
        {confirmTransfer ? <>
          <Button disabled={pending} onClick={() => void confirm()}>{t('COMMUNITY_CONFIRM_TRANSFER')}</Button>
          <Button variation="secondary" disabled={pending} onClick={() => setConfirmTransfer(false)}>{t('COMMUNITY_CANCEL_TRANSFER')}</Button>
        </> : <Button variation="secondary" disabled={pending} onClick={() => setConfirmTransfer(true)}>{t('COMMUNITY_TRANSFER_OWNERSHIP')}</Button>}
      </div>
    )
  }
  return (
    <div className="account-card__relationship-actions">
      {actorRole === 'owner' && <Button variation="secondary" disabled={pending} onClick={() => void run(() => updateRelationship(memberProfileId, communityId, 'moderator', actorProfileId))}>{t('COMMUNITY_PROMOTE_MODERATOR')}</Button>}
      <Button variation="cancel" disabled={pending} onClick={() => void ban()}>{t('COMMUNITY_BAN_MEMBER')}</Button>
    </div>
  )
}
