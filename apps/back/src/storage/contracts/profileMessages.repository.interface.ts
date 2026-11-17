import type { ListSort, PaginatedResult, ProfileMessage, ProfileMessageFavoriteChange, ProfileMessageRemoval, ProfileMessageWrite, ProfileMessagesPageData } from '../repository.types'

export interface ProfileMessagesRepository {
  createProfileMessage(change: ProfileMessageWrite): Promise<ProfileMessage>
  deleteProfileMessage(change: ProfileMessageRemoval): Promise<void>
  setProfileMessageFavorite(change: ProfileMessageFavoriteChange): Promise<ProfileMessage>
  getProfileMessages(
    profileId: string,
    userId: string | null,
    page: number
  ): Promise<PaginatedResult<ProfileMessage>>
  getProfileMessagesPage(
    url: string,
    userId: string | null,
    page: number,
    query: string | undefined,
    sort: ListSort,
    messageTab: 'all' | 'favorites'
  ): Promise<ProfileMessagesPageData>
}
