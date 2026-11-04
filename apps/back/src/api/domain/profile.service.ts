import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
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
    const user = await this.auth.getUser(userId)
    return paginate((await this.access.readProfiles()).filter(p => user.profiles.includes(p.id)), q)
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
    await this.uploads?.validateAvatarUrl(userId, picture, 'profile-avatar')
    await this.uploads?.validateEditorImages(userId, about)
    const aboutText = getRichTextPlainText(about)
    if (!name || about.length > 12000 || aboutText.length > 500 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url) ||
      !['social', 'rp', 'business'].includes(input.type) ||
      (picture && !/^https?:\\/\\//i.test(picture))) throw new ConflictException('INVALID_PROFILE')
    const profile: Profile = { id: randomUUID(), name, url, picture, about, type: input.type }

    const created = await this.data.transaction<{
      user: AuthenticatedUser
      previousCurrentProfile: string | null
    }>(['profiles', 'accounts'], collections => {
      const profiles = collections.profiles as Profile[]
      const accounts = collections.accounts as AccountRecord[]
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
      const user: AuthenticatedUser = {
        id: updatedAccount.id,
        email: updatedAccount.email,
        profiles: [...updatedAccount.profiles],
        currentProfile: updatedAccount.currentProfile
      }

      return {
        records: {
          ...collections,
          profiles: [...profiles, profile],
          accounts: accounts.map(item => item.id === userId ? updatedAccount : item)
        },
        result: { user, previousCurrentProfile: account.currentProfile }
      }
    })

    try {
      await this.uploads?.attachAvatarUrl(userId, picture, 'profile-avatar', 'profile', profile.id)
      await this.uploads?.attachEditorImages(userId, about, 'profile', profile.id)
    } catch (error) {
      const rollbackErrors: unknown[] = []
      try {
        await this.uploads?.detachResourceAttachments(userId, 'profile', profile.id)
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
      try {
        await this.data.transaction(['profiles', 'accounts'], collections => {
          const profiles = collections.profiles as Profile[]
          const accounts = collections.accounts as AccountRecord[]
          const nextAccounts = accounts.map(account => {
            if (account.id !== userId || !account.profiles.includes(profile.id)) return account
            const remainingProfiles = account.profiles.filter(id => id !== profile.id)
            const currentProfile = account.currentProfile === profile.id
              ? (created.previousCurrentProfile && remainingProfiles.includes(created.previousCurrentProfile)
                ? created.previousCurrentProfile
                : remainingProfiles[0] ?? null)
              : account.currentProfile
            return { ...account, profiles: remainingProfiles, currentProfile }
          })
          return {
            records: {
              ...collections,
              profiles: profiles.filter(item => item.id !== profile.id),
              accounts: nextAccounts
            },
            result: undefined
          }
        })
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
      if (rollbackErrors.length > 0) {
        throw new InternalServerErrorException('PROFILE_CREATE_ROLLBACK_FAILED')
      }
      throw error
    }

    return { profile, user: created.user }
  }

  async updateProfile(userId: string, profileId: string, input: Omit<CreateProfileInput, 'type'>): Promise<Profile> {
    await this.access.assertOwns(userId, profileId)
    const profiles = await this.access.readProfiles()
    const current = profiles.find(profile => profile.id === profileId)
    if (!current) throw new NotFoundException('PROFILE_NOT_FOUND')

    const name = input.name.trim()
    const url = normalizeEntityUrl(input.url || name)
    const picture = input.picture.trim()
    const about = sanitizeRichText(input.about)
    const aboutText = getRichTextPlainText(about)
    if (!name || about.length > 12000 || aboutText.length > 500 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url) ||
      (picture && !/^https?:\/\//i.test(picture))) throw new ConflictException('INVALID_PROFILE')
    if (profiles.some(profile => profile.id !== profileId && profile.url === url)) {
      throw new ConflictException('PROFILE_URL_ALREADY_IN_USE')
    }

    if (picture !== current.picture) await this.uploads?.validateAvatarUrl(userId, picture, 'profile-avatar')
    const newEditorImages = getNewEditorImages(about, current.about)
    await this.uploads?.validateEditorImages(userId, newEditorImages)

    let updated: Profile | undefined
    await this.data.update<Profile>('profiles', currentProfiles => {
      const latest = currentProfiles.find(profile => profile.id === profileId)
      if (!latest) throw new NotFoundException('PROFILE_NOT_FOUND')
      if (currentProfiles.some(profile => profile.id !== profileId && profile.url === url)) {
        throw new ConflictException('PROFILE_URL_ALREADY_IN_USE')
      }
      updated = { ...latest, name, url, picture, about }
      return currentProfiles.map(profile => profile.id === profileId ? updated! : profile)
    })
    if (picture !== current.picture) {
      await this.uploads?.attachAvatarUrl(userId, picture, 'profile-avatar', 'profile', profileId)
    }
    if (newEditorImages) {
      await this.uploads?.attachEditorImages(userId, newEditorImages, 'profile', profileId)
    }
    return updated!
  }

  async getProfileRelationships(userId: string, profileId: string): Promise<Relationship[]> {
    await this.access.assertOwns(userId, profileId)
    return (await this.data.read<Relationship>('relationships')).filter(r => r.profiles.includes(profileId))
  }
  async getProfileFriends(profileId: string, q: PaginationDto): Promise<PaginatedResult<Profile>> {
    const profile = (await this.access.readProfiles()).find(item => item.id === profileId)
    if (!profile) throw new NotFoundException('PROFILE_NOT_FOUND')
    const relations = await this.data.read<Relationship>('relationships')
    const ids = relations.filter(r => r.type === 'connection' && r.profiles.includes(profileId))
      .map(r => r.profiles.find(id => id !== profileId)!)
    return paginate((await this.getProfilesByIds(ids)).filter(friend => friend.type === profile.type), q)
  }

  async updateProfileRelationship(userId: string, source: string, target: string, type: RelationshipType): Promise<Relationship> {
    await this.access.assertOwns(userId, source)
    if (!source || !target || source === target) throw new ForbiddenException('INVALID_RELATIONSHIP_PARTICIPANTS')
    const profiles = await this.access.readProfiles()
    this.access.assertSameType(profiles.find(profile => profile.id === source), profiles.find(profile => profile.id === target))
    const pair = [source, target].sort() as [string, string]
    let value: Relationship | undefined
    await this.data.update<Relationship>('relationships', all => {
      const current = all.find(r => r.profiles[0] === pair[0] && r.profiles[1] === pair[1])
      if (type === 'requested' && current) throw new ConflictException('RELATIONSHIP_ALREADY_EXISTS')
      if (type === 'connection' && (current?.type !== 'requested' || current.requestedBy === source)) {
        throw new ForbiddenException('ONLY_RECIPIENT_CAN_ACCEPT_REQUEST')
      }
      const next: Relationship = {
        profiles: pair, type, requestedBy: type === 'requested' ? source : null,
        blockedBy: type === 'blocked' ? source : null, updatedAt: Date.now()
      }
      value = next
      return [...all.filter(r => r.profiles[0] !== pair[0] || r.profiles[1] !== pair[1]), next]
    })
    return value!
  }
  async removeProfileRelationship(userId: string, source: string, target: string): Promise<void> {
    await this.access.assertOwns(userId, source)
    const profiles = await this.access.readProfiles()
    this.access.assertSameType(profiles.find(profile => profile.id === source), profiles.find(profile => profile.id === target))
    const pair = [source, target].sort()
    await this.data.update<Relationship>('relationships', all => {
      const current = all.find(r => r.profiles[0] === pair[0] && r.profiles[1] === pair[1])
      if (current?.type === 'blocked' && current.blockedBy && current.blockedBy !== source) {
        throw new ForbiddenException('ONLY_BLOCKER_CAN_UNBLOCK')
      }
      return all.filter(r => r.profiles[0] !== pair[0] || r.profiles[1] !== pair[1])
    })
  }


}
