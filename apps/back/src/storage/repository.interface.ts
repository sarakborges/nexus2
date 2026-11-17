import type { AccountRepository } from './contracts/accounts.repository.interface'
import type { MediaRepository } from './contracts/media.repository.interface'
import type { ProfilesRepository } from './contracts/profiles.repository.interface'
import type { CommunitiesRepository } from './contracts/communities.repository.interface'
import type { RelationshipsRepository } from './contracts/relationships.repository.interface'
import type { ProfileMessagesRepository } from './contracts/profileMessages.repository.interface'
import type { CommunityForumRepository } from './contracts/communityForum.repository.interface'
import type { ActivityRepository } from './contracts/activity.repository.interface'
import type { SearchRepository } from './contracts/search.repository.interface'

export * from './repository.types'
export type { AccountRepository } from './contracts/accounts.repository.interface'
export type { MediaRepository } from './contracts/media.repository.interface'
export type { ProfilesRepository } from './contracts/profiles.repository.interface'
export type { CommunitiesRepository } from './contracts/communities.repository.interface'
export type { RelationshipsRepository } from './contracts/relationships.repository.interface'
export type { ProfileMessagesRepository } from './contracts/profileMessages.repository.interface'
export type { CommunityForumRepository } from './contracts/communityForum.repository.interface'
export type { ActivityRepository } from './contracts/activity.repository.interface'
export type { SearchRepository } from './contracts/search.repository.interface'

export const DATA_REPOSITORY = Symbol('DATA_REPOSITORY')

export interface DataRepository extends
  AccountRepository,
  MediaRepository,
  ProfilesRepository,
  CommunitiesRepository,
  RelationshipsRepository,
  ProfileMessagesRepository,
  CommunityForumRepository,
  ActivityRepository,
  SearchRepository {}
