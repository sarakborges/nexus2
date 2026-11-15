import type { CommunityMemberEntryProps } from './CommunityMemberEntry.types'
import './CommunityMemberEntry.style.scss'

import { AccountIdentityLink } from '@/Components/Molecules/AccountIdentityLink'
import { ROUTES } from '@/Constants/routes'
import { CommunityMemberActions } from '@/Components/Molecules/CommunityMemberActions'
import { useTranslations } from '@/Hooks/Language'

export function CommunityMemberEntry({
  profile,
  relationships,
  communityId,
  actorProfileId,
  actorRole,
  isStaff
}: CommunityMemberEntryProps) {
  const { t } = useTranslations()
  const roleKey =
    profile.role === 'owner'
      ? 'COMMUNITY_ROLE_OWNER'
      : profile.role === 'moderator'
        ? 'COMMUNITY_ROLE_MODERATOR'
        : profile.role === 'connection'
          ? 'COMMUNITY_ROLE_MEMBER'
          : null
  const relationship =
    relationships.find(
      (record) =>
        record.profiles[0] === profile.id &&
        record.profiles[1] === communityId
    ) ?? null

  return (
    <article className="account-card__profile-entry">
      <AccountIdentityLink
        to={ROUTES.profile + '/' + profile.url}
        name={profile.name}
        picture={profile.picture}
        secondary={'@' + profile.url}
        className="account-card__profile-entry-identity"
        avatarClassName="account-card__profile-entry-avatar"
        copyClassName="account-card__profile-entry-copy"
        nameClassName="account-card__link"
        secondaryClassName="account-card__profile-entry-secondary"
        title={profile.name}
        ariaLabel={profile.name}
      >
        {roleKey && (
          <span className="community-member-entry__role">{t(roleKey)}</span>
        )}
      </AccountIdentityLink>
      {isStaff && actorProfileId && profile.role !== 'owner' && (
        <CommunityMemberActions
          memberProfileId={profile.id}
          communityId={communityId}
          actorProfileId={actorProfileId}
          actorRole={actorRole as 'owner' | 'moderator'}
          relationship={relationship}
        />
      )}
    </article>
  )
}
