import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type {
  AuthenticatedUser,
  CreateProfileInput,
  CreateProfileResult,
  PaginatedResult,
  Profile,
  Relationship,
  RelationshipType
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { AuthService } from '../auth/auth.service'
import type { AccountRecord } from '../auth/auth.types'
import { paginate, type PaginationDto } from '../pagination/pagination.dto'
import { getRichTextPlainText, sanitizeRichText } from './rich-text-sanitizer'
import { UploadsService } from '../uploads/uploads.service'
import type { UploadedFileRecord } from '../uploads/uploads.types'
import { DomainAccessService } from './domain-access.service'
import { getNewEditorImages, normalizeEntityUrl } from './domain.utils'

@Injectable()
export class ProfileService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly auth: AuthService,
    private readonly access: DomainAccessService,
    @Optional() private readonly uploads?: UploadsService
  ) {}

  async listProfiles(q: PaginationDto): Promise<PaginatedResult<Profile>> {
    return paginate(await this.access.readProfiles(), q)
  }
  async listOwnedProfiles(userId: string, q: PaginationDto): Promise<PaginatedResult<Profile>> {
    return this.data.transaction<PaginatedResult<Profile>>(
      ['accounts', 'profiles'],
      collections => {
        const account = (collections.accounts as AccountRecord[]).find(item => item.id === userId)
        if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        const ownedProfileIds = new Set(account.profiles)
        const result = paginate(
          (collections.profiles as Profile[]).filter(profile => ownedProfileIds.has(profile.id)),
          q
        )
        return { records: collections, result }
      }
    )
  }
  async getProfile(url: string): Promise<Profile> {
    const value = normalizeEntityUrl(url)
    const found = (await this.access.readProfiles()).find(p => p.url === value)
    if (!found) throw new NotFoundException('PROFILE_NOT_FOUND')
    return found
  }
  async getProfilesByIds(ids: string[]): Promise<Profile[]> {
    const set = new Set(ids)
    return (await this.access.readProfiles()).filter(p => set.has(p.id))
  }
  async createProfile(userId: string, input: CreateProfileInput): Promise<CreateProfileResult> {
    const name = input.name.trim()
    const url = normalizeEntityUrl(input.url || name)
    const picture = input.picture.trim()
    const about = sanitizeRichText(input.about)
    const aboutText = getRichTextPlainText(about)
    if (!name || about.length > 12000 || aboutText.length > 500 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url) ||
      !['social', 'rp', 'business'].includes(input.type) ||
      (picture && !/^https?:\/\//i.test(picture))) throw new ConflictException('INVALID_PROFILE')
    const profile: Profile = { id: randomUUID(), name, url, picture, about, type: input.type }

    const user = await this.data.transaction<AuthenticatedUser>(
      ['profiles', 'accounts', 'media_files'],
      collections => {
        const profiles = collections.profiles as Profile[]
        const accounts = collections.accounts as AccountRecord[]
        const mediaFiles = collections.media_files as UploadedFileRecord[]
        const account = accounts.find(item => item.id === userId)
        if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        if (profiles.some(item => item.url === url)) {
          throw new ConflictException('PROFILE_URL_ALREADY_IN_USE')
        }

        const updatedAccount: AccountRecord = {
          ...account,
          profiles: [...account.profiles, profile.id],
          currentProfile: profile.id
        }
        const nextMediaFiles = this.uploads
          ? this.uploads.attachEditorImagesToRecords(
              this.uploads.attachAvatarUrlToRecords(
                mediaFiles, userId, picture, 'profile-avatar', 'profile', profile.id
              ),
              userId, about, 'profile', profile.id
            )
          : mediaFiles

        return {
          records: {
            ...collections,
            profiles: [...profiles, profile],
            accounts: accounts.map(item => item.id === userId ? updatedAccount : item),
            media_files: nextMediaFiles
          },
          result: {
            id: updatedAccount.id,
            email: updatedAccount.email,
            profiles: [...updatedAccount.profiles],
            currentProfile: updatedAccount.currentProfile
          }
        }
      }
    )

    return { profile, user }
  }

  async updateProfile(userId: string, profileId: string, input: Omit<CreateProfileInput, 'type'>): Promise<Profile> {
    const name = input.name.trim()
    const url = normalizeEntityUrl(input.url || name)
    const picture = input.picture.trim()
    const about = sanitizeRichText(input.about)
    const aboutText = getRichTextPlainText(about)
    const result = await this.data.transaction<{ profile: Profile; previousPicture: string | null }>(
      ['accounts', 'profiles', 'media_files'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const currentProfiles = collections.profiles as Profile[]
        const mediaFiles = collections.media_files as UploadedFileRecord[]
        this.access.assertOwnsInRecords(userId, profileId, accounts, currentProfiles)

        const latest = currentProfiles.find(profile => profile.id === profileId)
        if (!latest) throw new NotFoundException('PROFILE_NOT_FOUND')
        if (!name || about.length > 12000 || aboutText.length > 500 ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url) ||
          (picture && !/^https?:\/\//i.test(picture))) throw new ConflictException('INVALID_PROFILE')
        if (currentProfiles.some(profile => profile.id !== profileId && profile.url === url)) {
          throw new ConflictException('PROFILE_URL_ALREADY_IN_USE')
        }

        let nextMediaFiles = mediaFiles
        if (this.uploads) {
          if (picture !== latest.picture) {
            nextMediaFiles = this.uploads.attachAvatarUrlToRecords(
              nextMediaFiles, userId, picture, 'profile-avatar', 'profile', profileId
            )
          }
          nextMediaFiles = this.uploads.attachEditorImagesToRecords(
            nextMediaFiles,
            userId,
            getNewEditorImages(about, latest.about),
            'profile',
            profileId
          )
        }

        const updated: Profile = { ...latest, name, url, picture, about }
        return {
          records: {
            ...collections,
            profiles: currentProfiles.map(profile => profile.id === profileId ? updated : profile),
            media_files: nextMediaFiles
          },
          result: {
            profile: updated,
            previousPicture: picture !== latest.picture ? latest.picture : null
          }
        }
      }
    )
    if (result.previousPicture) await this.uploads?.deletePreviousAvatar(result.previousPicture)
    return result.profile
  }

  async getProfileRelationships(userId: string, profileId: string): Promise<Relationship[]> {
    return this.data.transaction<Relationship[]>(
      ['accounts', 'profiles', 'relationships'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        this.access.assertOwnsInRecords(userId, profileId, accounts, profiles)
        const relationships = collections.relationships as Relationship[]
        return {
          records: collections,
          result: relationships.filter(record => record.profiles.includes(profileId))
        }
      }
    )
  }
  async getProfileFriends(profileId: string, q: PaginationDto): Promise<PaginatedResult<Profile>> {
    return this.data.transaction<PaginatedResult<Profile>>(
      ['profiles', 'relationships'],
      collections => {
        const profiles = collections.profiles as Profile[]
        const profile = profiles.find(item => item.id === profileId)
        if (!profile) throw new NotFoundException('PROFILE_NOT_FOUND')
        const friendIds = new Set(
          (collections.relationships as Relationship[])
            .filter(record => record.type === 'connection' && record.profiles.includes(profileId))
            .map(record => record.profiles.find(id => id !== profileId)!)
        )
        const friends = profiles
          .filter(friend => friendIds.has(friend.id) && friend.type === profile.type)
          .map(friend => ({ ...friend, about: sanitizeRichText(friend.about ?? '') }))
        return { records: collections, result: paginate(friends, q) }
      }
    )
  }

  async updateProfileRelationship(userId: string, source: string, target: string, type: RelationshipType): Promise<Relationship> {
    const now = Date.now()
    return this.data.transaction<Relationship>(
      ['accounts', 'profiles', 'relationships'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        const all = collections.relationships as Relationship[]
        this.access.assertOwnsInRecords(userId, source, accounts, profiles)
        if (!source || !target || source === target) {
          throw new ForbiddenException('INVALID_RELATIONSHIP_PARTICIPANTS')
        }
        this.access.assertSameType(
          profiles.find(profile => profile.id === source),
          profiles.find(profile => profile.id === target)
        )

        const pair = [source, target].sort() as [string, string]
        const current = all.find(record =>
          record.profiles[0] === pair[0] && record.profiles[1] === pair[1]
        )
        if (type === 'requested' && current) {
          throw new ConflictException('RELATIONSHIP_ALREADY_EXISTS')
        }
        if (type === 'connection' && (
          current?.type !== 'requested' || current.requestedBy === source
        )) {
          throw new ForbiddenException('ONLY_RECIPIENT_CAN_ACCEPT_REQUEST')
        }

        const next: Relationship = {
          profiles: pair,
          type,
          requestedBy: type === 'requested' ? source : null,
          blockedBy: type === 'blocked' ? source : null,
          updatedAt: now
        }
        return {
          records: {
            ...collections,
            relationships: [
              ...all.filter(record =>
                record.profiles[0] !== pair[0] || record.profiles[1] !== pair[1]
              ),
              next
            ]
          },
          result: next
        }
      }
    )
  }

  async removeProfileRelationship(userId: string, source: string, target: string): Promise<void> {
    const pair = [source, target].sort()
    await this.data.transaction(
      ['accounts', 'profiles', 'relationships'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        const all = collections.relationships as Relationship[]
        this.access.assertOwnsInRecords(userId, source, accounts, profiles)
        this.access.assertSameType(
          profiles.find(profile => profile.id === source),
          profiles.find(profile => profile.id === target)
        )

        const current = all.find(record =>
          record.profiles[0] === pair[0] && record.profiles[1] === pair[1]
        )
        if (current?.type === 'blocked' && current.blockedBy && current.blockedBy !== source) {
          throw new ForbiddenException('ONLY_BLOCKER_CAN_UNBLOCK')
        }
        return {
          records: {
            ...collections,
            relationships: all.filter(record =>
              record.profiles[0] !== pair[0] || record.profiles[1] !== pair[1]
            )
          },
          result: undefined
        }
      }
    )
  }


}
