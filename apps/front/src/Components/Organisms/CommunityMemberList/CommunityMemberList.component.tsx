import { CommunityMemberEntry } from '@/Components/Molecules/CommunityMemberEntry'
import type { CommunityMemberListProps } from './CommunityMemberList.types'

export function CommunityMemberList({
  members,
  relationships,
  communityId,
  actorProfileId,
  actorRole,
  isStaff
}: CommunityMemberListProps) {
  return (
    <div className="account-card__profile-list account-card__profile-list--grid">
      {members.map(profile => (
        <CommunityMemberEntry
          key={profile.id}
          profile={profile}
          relationships={relationships}
          communityId={communityId}
          actorProfileId={actorProfileId}
          actorRole={actorRole}
          isStaff={isStaff}
        />
      ))}
    </div>
  )
}
