import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import type {
  CommunityMember,
  CommunityMembersPageData,
  CommunityRelationship,
  Profile
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import { CommunityMembersPageDto } from './community-members-page.dto'
import { paginate } from '../pagination/pagination.helper'
import { filterAndSortList } from '../pagination/list-query.helper'
import { DomainAccessService } from './domain-access.service'
import { sanitizeRichText } from './rich-text-sanitizer'

const COMMUNITY_MEMBERS_PAGE_COLLECTIONS = [
  'accounts',
  'profiles',
  'communities',
  'community_relationships'
] as const

@Injectable()
export class CommunityMembersPageService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService
  ) {}

  getCommunityMembersPage(
    communityUrl: string,
    query: CommunityMembersPageDto,
    userId: string | null
  ): Promise<CommunityMembersPageData> {
    if (this.data.getCommunityMembersPage) {
      return this.data.getCommunityMembersPage(
        communityUrl,
        userId,
        query.page,
        query.pendingPage,
        query.query,
        query.sort,
        query.tab
      ).then(page => ({
        ...page,
        members: {
          ...page.members,
          items: page.members.items.map(profile => ({
            ...profile,
            about: sanitizeRichText(profile.about ?? '')
          }))
        },
        pending: {
          ...page.pending,
          items: page.pending.items.map(profile => ({
            ...profile,
            about: sanitizeRichText(profile.about ?? '')
          }))
        }
      })).catch(error => {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('ACCOUNT_NOT_FOUND')) {
          throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        }
        if (message.includes('COMMUNITY_NOT_FOUND')) {
          throw new NotFoundException('COMMUNITY_NOT_FOUND')
        }
        throw error
      })
    }

    return this.data.transaction<CommunityMembersPageData>(
      COMMUNITY_MEMBERS_PAGE_COLLECTIONS,
      (collections) => {
        const normalized = this.access.normalizeCommunitiesInRecords(collections)
        const records = normalized.records
        const community = normalized.communities.find(
          (item) => item.url === communityUrl
        )
        if (!community) {
          return {
            records,
            result: {
              community: null,
              relationships: [],
              viewerRelationship: null,
              currentProfileType: null,
              actorProfileId: null,
              actorRole: null,
              isStaff: false,
              visibleTab: 'all',
              members: paginate<CommunityMember>([], query),
              pending: paginate<CommunityMember>([], {
                ...query,
                page: query.pendingPage
              })
            }
          }
        }

        const accounts = records.accounts as AccountRecord[]
        const account = userId
          ? accounts.find((item) => item.id === userId)
          : undefined
        if (userId && !account) {
          throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        }

        const allRelationships =
          records.community_relationships as CommunityRelationship[]
        this.access.assertCommunityReadableInRecords(
          community.id,
          userId,
          accounts,
          normalized.communities,
          allRelationships
        )

        const profiles = records.profiles as Profile[]
        const profilesById = new Map(
          profiles.map((profile) => [profile.id, profile] as const)
        )
        const ownedProfileIds = new Set(account?.profiles ?? [])
        const viewerRelationships = allRelationships.filter(
          (relationship) =>
            relationship.profiles[1] === community.id &&
            ownedProfileIds.has(relationship.profiles[0]) &&
            profilesById.get(relationship.profiles[0])?.type === community.type
        )
        const currentProfileId = account?.currentProfile && ownedProfileIds.has(account.currentProfile) ? account.currentProfile : null
        const currentProfileType = currentProfileId ? profilesById.get(currentProfileId)?.type ?? null : null
        const viewerRelationship = currentProfileId ? viewerRelationships.find((relationship) => relationship.profiles[0] === currentProfileId) ?? null : null
        const hasCompatibleActiveProfile = !currentProfileId || currentProfileType === community.type
        const managementRelationship = hasCompatibleActiveProfile
          ? viewerRelationships.find(
            (relationship) =>
              relationship.type === 'owner' ||
              relationship.type === 'moderator'
          ) ?? null
          : null
        const actorProfileId =
          managementRelationship?.profiles[0] ?? null
        const actorRole = managementRelationship?.type ?? null
        const isStaff = Boolean(actorProfileId)
        const requestedTab =
          query.tab === 'staff' || query.tab === 'banned'
            ? query.tab
            : 'all'
        const visibleTab: CommunityMembersPageData['visibleTab'] =
          isStaff ? requestedTab : 'all'

        const memberRoles =
          visibleTab === 'staff'
            ? ['owner', 'moderator']
            : visibleTab === 'banned'
              ? ['blocked']
              : ['owner', 'moderator', 'connection']
        const roleByProfileId = new Map(
          allRelationships
            .filter(
              (relationship) =>
                relationship.profiles[1] === community.id &&
                memberRoles.includes(relationship.type)
            )
            .map((relationship) => [
              relationship.profiles[0],
              relationship.type
            ] as const)
        )
        const memberProfiles = filterAndSortList(
          profiles.filter(profile => roleByProfileId.has(profile.id) && profile.type === community.type).map(profile => ({ ...profile, about: sanitizeRichText(profile.about ?? ''), role: roleByProfileId.get(profile.id)! })),
          query.query, query.sort,
          profile => [profile.name,profile.about,profile.url].join(' '), profile => profile.lastActivity || profile.createdAt, profile => profile.name, profile => profile.id
        )
        const members = paginate(memberProfiles, query)

        const pendingProfileIds = new Set(
          isStaff
            ? allRelationships
                .filter(
                  (relationship) =>
                    relationship.profiles[1] === community.id &&
                    relationship.type === 'requested'
                )
                .map((relationship) => relationship.profiles[0])
            : []
        )
        const pendingProfiles = isStaff
          ? filterAndSortList(
              profiles.filter(profile => profile.type === community.type && pendingProfileIds.has(profile.id)).map(profile => ({ ...profile, about: sanitizeRichText(profile.about ?? ''), role: 'requested' })),
              query.query, query.sort,
              profile => [profile.name,profile.about,profile.url].join(' '), profile => profile.lastActivity || profile.createdAt, profile => profile.name, profile => profile.id
            )
          : []
        const pending = paginate(pendingProfiles, {
          ...query,
          page: query.pendingPage
        })

        return {
          records,
          result: {
            community,
            relationships: viewerRelationships,
            viewerRelationship,
            currentProfileType,
            actorProfileId,
            actorRole,
            isStaff,
            visibleTab,
            members,
            pending
          }
        }
      }
    )
  }
}
