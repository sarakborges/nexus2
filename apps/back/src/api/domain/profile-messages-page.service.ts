import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type {
  Profile,
  ProfileMessage,
  ProfileMessagesPageData,
  Relationship
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import type { PaginationDto } from '../pagination/pagination.dto'
import { paginate } from '../pagination/pagination.helper'
import { normalizeEntityUrl } from './domain.utils'
import { sanitizeRichText } from './rich-text-sanitizer'

const PROFILE_MESSAGES_PAGE_COLLECTIONS = [
  'accounts',
  'profiles',
  'relationships',
  'profile_messages'
] as const

@Injectable()
export class ProfileMessagesPageService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository
  ) {}

  getProfileMessagesPage(
    profileUrl: string,
    query: PaginationDto,
    userId: string | null
  ): Promise<ProfileMessagesPageData> {
    const normalizedUrl = normalizeEntityUrl(profileUrl)

    return this.data.transaction<ProfileMessagesPageData>(
      PROFILE_MESSAGES_PAGE_COLLECTIONS,
      (collections) => {
        const accounts = collections.accounts as AccountRecord[]
        const account = userId
          ? accounts.find((item) => item.id === userId)
          : undefined
        if (userId && !account) {
          throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        }

        const profiles = collections.profiles as Profile[]
        const profileRecord = profiles.find(
          (profile) => profile.url === normalizedUrl
        )
        if (!profileRecord) {
          return {
            records: collections,
            result: {
              profile: null,
              viewerRelationship: null,
              isProfileOwner: false,
              messages: paginate<ProfileMessage>([], query),
              senders: []
            }
          }
        }

        const profile = {
          ...profileRecord,
          about: sanitizeRichText(profileRecord.about ?? '')
        }
        const viewerProfileIds = new Set(account?.profiles ?? [])
        const currentProfileId = account?.currentProfile && viewerProfileIds.has(account.currentProfile) ? account.currentProfile : null
        const viewerRelationship = currentProfileId && currentProfileId !== profile.id
          ? (collections.relationships as Relationship[]).find((relationship) => relationship.profiles.includes(currentProfileId) && relationship.profiles.includes(profile.id)) ?? null
          : null
        const isProfileOwner = viewerProfileIds.has(profile.id)
        const visibleMessages = (
          collections.profile_messages as ProfileMessage[]
        )
          .filter(
            (message) =>
              message.toProfileId === profile.id &&
              (isProfileOwner || viewerProfileIds.has(message.fromProfileId))
          )
          .map((message) => ({
            ...message,
            content: sanitizeRichText(message.content ?? '')
          }))
          .sort(
            (a, b) =>
              b.createdAt - a.createdAt || a.id.localeCompare(b.id)
          )
        const messages = paginate(visibleMessages, query)
        const senderIds = new Set(
          messages.items.map((message) => message.fromProfileId)
        )
        const senders = profiles
          .filter((sender) => senderIds.has(sender.id))
          .map((sender) => ({
            ...sender,
            about: sanitizeRichText(sender.about ?? '')
          }))

        return {
          records: collections,
          result: {
            profile,
            viewerRelationship,
            isProfileOwner,
            messages,
            senders
          }
        }
      }
    )
  }
}
