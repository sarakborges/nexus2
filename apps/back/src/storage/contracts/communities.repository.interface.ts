import type { CommunitiesPageData, Community, CommunityCreateWrite, CommunityEditPageData, CommunityForumComposerPageData, CommunityMembersPageData, CommunityPageData, CommunityUpdateWrite, ListSort, PaginatedResult } from '../repository.types'

export interface CommunitiesRepository {
  getCommunitiesByIds(ids: readonly string[]): Promise<Community[]>
  getSuggestedCommunities(profileId: string, limit: number): Promise<Community[]>
  createCommunity(change: CommunityCreateWrite): Promise<Community>
  updateCommunity(
    change: CommunityUpdateWrite
  ): Promise<{ community: Community; previousPicture: string | null }>
  getPublicCommunities(page: number): Promise<PaginatedResult<Community>>
  getCommunityByUrl(url: string, userId: string | null): Promise<Community>
  getProfileCommunities(profileId: string, page: number): Promise<PaginatedResult<Community>>
  getCommunityEditPage(url: string, userId: string | null): Promise<CommunityEditPageData>
  getCommunityForumComposerPage(url: string, userId: string | null): Promise<CommunityForumComposerPageData>
  getCommunitiesPage(
    userId: string,
    page: number,
    query: string | undefined,
    sort: ListSort,
    communityTab: 'all' | 'managed'
  ): Promise<CommunitiesPageData>
  getCommunityPage(url: string, userId: string | null): Promise<CommunityPageData>
  getCommunityMembersPage(
    url: string,
    userId: string | null,
    page: number,
    pendingPage: number,
    query: string | undefined,
    sort: ListSort,
    tab: string | undefined
  ): Promise<CommunityMembersPageData>
}
