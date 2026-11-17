import type { AuthenticatedUser, ListSort, PaginatedResult, Profile, ProfileCreateWrite, ProfileDirectoryPageData, ProfileEditPageData, ProfilePageData, ProfilePost, ProfileSettings, ProfileUpdateWrite } from '../repository.types'

export interface ProfilesRepository {
  getProfilesByIds(ids: readonly string[]): Promise<Profile[]>
  createProfile(change: ProfileCreateWrite): Promise<AuthenticatedUser>
  updateProfile(
    change: ProfileUpdateWrite
  ): Promise<{ profile: Profile; previousPicture: string | null }>
  createProfilePost(
    userId: string,
    post: ProfilePost,
    imageIds: readonly string[]
  ): Promise<ProfilePost>
  getProfileSettings(userId: string, profileId: string): Promise<ProfileSettings>
  updateProfileSettings(
    userId: string,
    profileId: string,
    patch: Partial<ProfileSettings>
  ): Promise<ProfileSettings>
  getProfilesPage(page: number): Promise<PaginatedResult<Profile>>
  getProfileByUrl(url: string): Promise<Profile>
  getOwnedProfiles(userId: string, page: number): Promise<PaginatedResult<Profile>>
  getProfileFriends(profileId: string, page: number): Promise<PaginatedResult<Profile>>
  getProfileEditPage(url: string, userId: string | null): Promise<ProfileEditPageData>
  getProfileDirectoryPage(
    url: string,
    kind: 'friends' | 'communities',
    userId: string | null,
    page: number,
    query: string | undefined,
    sort: ListSort
  ): Promise<ProfileDirectoryPageData>
  getProfilePage(url: string, userId: string | null): Promise<ProfilePageData>
}
