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
  CreateProfileInput,
  CreateProfileResult,
  PaginatedResult,
  Profile,
  Relationship,
  RelationshipType
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { AuthService } from '../auth/auth.service'
import type { PaginationDto } from '../pagination/pagination.dto'
import { sanitizeRichText } from './rich-text-sanitizer'
import { UploadsService } from '../uploads/uploads.service'
import { DomainAccessService } from './domain-access.service'
import { ProfileRelationshipService } from './profile-relationship.service'
import { normalizeEntityUrl } from './domain.utils'

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
    this.relationships = relationships ?? new ProfileRelationshipService(data)
  }

  async listProfiles(q: PaginationDto): Promise<PaginatedResult<Profile>> {
    const page = await this.data.getProfilesPage(q.page)
    return {
      ...page,
      items: this.access.normalizeProfiles(page.items)
    }
  }

  async listOwnedProfiles(userId: string, q: PaginationDto): Promise<PaginatedResult<Profile>> {
    try {
      const page = await this.data.getOwnedProfiles(userId, q.page)
      return {
        ...page,
        items: page.items.map(profile => ({
          ...profile,
          about: sanitizeRichText(profile.about ?? '')
        }))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('ACCOUNT_NOT_FOUND')) {
        throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
      }
      throw error
    }
  }

  async getProfile(url: string): Promise<Profile> {
    const value = normalizeEntityUrl(url)
    try {
      const profile = await this.data.getProfileByUrl(value)
      return this.access.normalizeProfiles([profile])[0]
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('PROFILE_NOT_FOUND')) {
        throw new NotFoundException('PROFILE_NOT_FOUND')
      }
      throw error
    }
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
      (picture && !/^https?:\\/\\//i.test(picture))) {
      throw new ConflictException('INVALID_PROFILE')
    }

    const profile: Profile = {
      id: randomUUID(),
      name,
      url,
      picture,
      about,
      type: input.type,
      createdAt,
      lastActivity: createdAt
    }
    try {
      const user = await this.data.createProfile({
        userId,
        profile,
        avatarPath: this.uploads?.getAvatarPath?.(picture) ?? null,
        editorImageIds: this.uploads?.getEditorImageIds?.(about) ?? []
      })
      return { profile, user }
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
  }

  async updateProfile(
    userId: string,
    profileId: string,
    input: Omit<CreateProfileInput, 'type'>
  ): Promise<Profile> {
    const name = input.name.trim()
    const url = normalizeEntityUrl(input.url || name)
    const picture = input.picture.trim()
    const about = sanitizeRichText(input.about)
    const lastActivity = Date.now()
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
        avatarPath: this.uploads?.getAvatarPath?.(picture) ?? null,
        editorImageIds: this.uploads?.getEditorImageIds?.(about) ?? []
      })
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
    if (result.previousPicture) {
      await this.uploads?.deletePreviousAvatar?.(result.previousPicture)
    }
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
