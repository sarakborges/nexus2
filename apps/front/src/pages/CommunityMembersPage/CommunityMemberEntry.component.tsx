import type { CommunityMemberEntryProps } from './CommunityMemberEntry.types'

import { CommunityMemberActions } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'

import { Link } from 'react-router'

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
      <Link
        className="account-card__profile-entry-identity"
        to={ROUTES.profile + '/' + profile.url}
      >
        <span className="account-card__profile-entry-avatar">
          {profile.picture ? (
            <img src={profile.picture} alt="" />
          ) : (
            <span aria-hidden="true">
              {profile.name.trim().charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <span className="account-card__profile-entry-copy">
          <span className="account-card__link">{profile.name}</span>
          <span className="account-card__profile-entry-secondary">
            @{profile.url}
          </span>
          {roleKey && (
            <span className="community-member__role">{t(roleKey)}</span>
          )}
        </span>
      </Link>
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
