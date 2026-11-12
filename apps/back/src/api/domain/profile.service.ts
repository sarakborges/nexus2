import {
  BadRequestException,
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
import { paginate } from '../pagination/pagination.helper'
import type { PaginationDto } from '../pagination/pagination.dto'
import { sanitizeRichText } from './rich-text-sanitizer'
import { UploadsService } from '../uploads/uploads.service'
import type { UploadedFileRecord } from '../uploads/uploads.types'
import { DomainAccessService } from './domain-access.service'
import { ProfileRelationshipService } from './profile-relationship.service'
import { getNewEditorImages, getRemovedEditorImages, normalizeEntityUrl } from './domain.utils'

@Injectable()
export class ProfileService {
  private readonly relationships: ProfileRelationshipService

  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly auth: AuthService,
    private readonly access: DomainAccessService,
    @Optional() private readonly uploads?: UploadsService,
    @Optional() relationships?: ProfileRelationshipService
  ) {
    this.relationships = relationships ?? new ProfileRelationshipService(data, access)
  }

  async listProfiles(q: PaginationDto): Promise<PaginatedResult<Profile>> {
    if (this.data.getProfilesPage) {
      const page = await this.data.getProfilesPage(q.page)
      return {
        ...page,
        items: this.access.normalizeProfiles(page.items)
      }
    }
    return paginate(await this.access.readProfiles(), q)
  }
  async listOwnedProfiles(userId: string, q: PaginationDto): Promise<PaginatedResult<Profile>> {
    if (this.data.getOwnedProfiles) {
      try {
        const page = await this.data.getOwnedProfiles(userId, q.page)
        return { ...page, items: page.items.map(profile => ({
          ...profile, about: sanitizeRichText(profile.about ?? '')
        })) }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('ACCOUNT_NOT_FOUND')) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        throw error
      }
    }
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
    if (this.data.getProfileByUrl) {
      try {
        const profile = await this.data.getProfileByUrl(value)
        return this.access.normalizeProfiles([profile])[0]
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('PROFILE_NOT_FOUND')) throw new NotFoundException('PROFILE_NOT_FOUND')
        throw error
      }
    }
    const found = (await this.access.readProfiles()).find(p => p.url === value)
    if (!found) throw new NotFoundException('PROFILE_NOT_FOUND')
    return found
  }
  getProfilesByIds(ids: string[]): Promise<Profile[]> {
    return this.access.readProfilesByIds(ids)
  }
  async createProfile(userId: string, input: CreateProfileInput): Promise<CreateProfileResult> {
    const name = input.name.trim()
    const url = normalizeEntityUrl(input.url || name)
    const picture = input.picture.trim()
    const about = sanitizeRichText(input.about)
    const createdAt = Date.now()
    if (!name || about.length > 8000 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url) ||
      !['social', 'rp', 'business'].includes(input.type) ||
      (picture && !/^https?:\/\//i.test(picture))) throw new ConflictException('INVALID_PROFILE')
    const profile: Profile = {
      id: randomUUID(), name, url, picture, about, type: input.type,
      createdAt, lastActivity: createdAt
    }

    if (this.data.createProfile) {
      try {
        const user = await this.data.createProfile({
          userId,
          profile,
          avatarPath: this.uploads?.getAvatarPath(picture) ?? null,
          editorImageIds: this.uploads?.getEditorImageIds(about) ?? []
        })
        return { profile, user }
      } catch (error) {
        this.throwRelationalWriteError(error)
      }
    }

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
    const lastActivity = Date.now()
    if (this.data.updateProfile) {
      let result: { profile: Profile; previousPicture: string | null }
      try {
        result = await this.data.updateProfile({
          userId,
          profileId,
          name,
          url,
          picture,
          about,
          lastActivity,
          avatarPath: this.uploads?.getAvatarPath(picture) ?? null,
          editorImageIds: this.uploads?.getEditorImageIds(about) ?? []
        })
      } catch (error) {
        this.throwRelationalWriteError(error)
      }
      if (result.previousPicture) await this.uploads?.deletePreviousAvatar(result.previousPicture)
      return result.profile
    }

    const result = await this.data.transaction<{ profile: Profile; previousPicture: string | null }>(
      ['accounts', 'profiles', 'media_files'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const currentProfiles = collections.profiles as Profile[]
        const mediaFiles = collections.media_files as UploadedFileRecord[]
        this.access.assertOwnsInRecords(userId, profileId, accounts, currentProfiles)

        const latest = currentProfiles.find(profile => profile.id === profileId)
        if (!latest) throw new NotFoundException('PROFILE_NOT_FOUND')
        if (!name || about.length > 8000 ||
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
          nextMediaFiles = this.uploads.detachEditorImagesFromRecords(
            nextMediaFiles,
            getRemovedEditorImages(latest.about, about),
            'profile',
            profileId
          )
          nextMediaFiles = this.uploads.attachEditorImagesToRecords(
            nextMediaFiles,
            userId,
            getNewEditorImages(about, latest.about),
            'profile',
            profileId
          )
        }

        const updated: Profile = {
          ...latest,
          name,
          url,
          picture,
          about,
          createdAt: Number.isFinite(latest.createdAt) ? latest.createdAt : 0,
          lastActivity
        }
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

  getProfileRelationships(userId: string, profileId: string): Promise<Relationship[]> {
    return this.relationships.getProfileRelationships(userId, profileId)
  }

  getProfileFriends(profileId: string, q: PaginationDto): Promise<PaginatedResult<Profile>> {
    return this.relationships.getProfileFriends(profileId, q)
  }

  updateProfileRelationship(
    userId: string,
    source: string,
    target: string,
    type: RelationshipType
  ): Promise<Relationship> {
    return this.relationships.updateProfileRelationship(userId, source, target, type)
  }

  removeProfileRelationship(userId: string, source: string, target: string): Promise<void> {
    return this.relationships.removeProfileRelationship(userId, source, target)
  }

  private throwRelationalWriteError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('ACCOUNT_NOT_FOUND')) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
    if (message.includes('PROFILE_NOT_OWNED')) throw new ForbiddenException('PROFILE_NOT_OWNED')
    if (message.includes('PROFILE_NOT_FOUND')) throw new NotFoundException('PROFILE_NOT_FOUND')
    if (message.includes('PROFILE_URL_ALREADY_IN_USE') || message.includes('PROFILE_ID_ALREADY_EXISTS')) {
      throw new ConflictException(message.includes('PROFILE_URL_ALREADY_IN_USE')
        ? 'PROFILE_URL_ALREADY_IN_USE'
        : 'PROFILE_ID_ALREADY_EXISTS')
    }
    if (message.includes('INVALID_PROFILE')) throw new BadRequestException('INVALID_PROFILE')
    if (message.includes('INVALID_EDITOR_IMAGE')) throw new BadRequestException('INVALID_EDITOR_IMAGE')
    if (message.includes('INVALID_AVATAR_UPLOAD')) throw new BadRequestException('INVALID_AVATAR_UPLOAD')
    throw error
  }


}
