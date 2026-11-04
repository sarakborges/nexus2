import { Inject, Injectable } from '@nestjs/common'
import type { CommunityRelationship, RecentActivity, Relationship } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { AuthService } from '../auth/auth.service'
import { DomainAccessService } from './domain-access.service'

@Injectable()
export class ActivityService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly auth: AuthService,
    private readonly access: DomainAccessService
  ) {}

  async getRecentActivity(userId: string): Promise<RecentActivity[]> {
    const user = await this.auth.getUser(userId)
    const ownedProfileIds = new Set(user.profiles)
    if (!ownedProfileIds.size) return []

    const [profiles, communities, relationships, communityRelationships] = await Promise.all([
      this.access.readProfiles(),
      this.access.readCommunities(),
      this.data.read<Relationship>('relationships'),
      this.data.read<CommunityRelationship>('community_relationships')
    ])
    const profilesById = new Map(profiles.map(profile => [profile.id, profile] as const))
    const communitiesById = new Map(communities.map(community => [community.id, community] as const))
    const activities: RecentActivity[] = []

    for (const relationship of relationships) {
      if (relationship.type !== 'connection') continue
      const ownedParticipants = relationship.profiles.filter(id => ownedProfileIds.has(id))
      if (ownedParticipants.length !== 1) continue
      const profile = profilesById.get(ownedParticipants[0])
      const friendId = relationship.profiles.find(id => id !== ownedParticipants[0])
      const friend = friendId ? profilesById.get(friendId) : undefined
      if (!profile || !friend || profile.type !== friend.type) continue
      activities.push({
        id: 'friend:' + relationship.profiles[0] + ':' + relationship.profiles[1],
        type: 'friend_connected',
        updatedAt: relationship.updatedAt,
        profile,
        friend
      })
    }

    for (const relationship of communityRelationships) {
      if (!ownedProfileIds.has(relationship.profiles[0])) continue
      if (relationship.type !== 'owner' && relationship.type !== 'moderator' && relationship.type !== 'connection') continue
      const profile = profilesById.get(relationship.profiles[0])
      const community = communitiesById.get(relationship.profiles[1])
      if (!profile || !community || profile.type !== community.type) continue
      activities.push({
        id: 'community:' + profile.id + ':' + community.id,
        type: 'community_membership',
        updatedAt: relationship.updatedAt,
        profile,
        community,
        role: relationship.type
      })
    }

    return activities
      .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
      .slice(0, 10)
  }
}
