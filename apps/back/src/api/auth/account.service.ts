import {
  Inject,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import type {
  AuthenticatedUser,
  UserPreferences
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from './auth.types'

@Injectable()
export class AccountService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly repository: DataRepository
  ) {}

  async getUser(userId: string): Promise<AuthenticatedUser> {
    const accounts = await this.repository.read<AccountRecord>('accounts')
    const account = accounts.find(item => item.id === userId)
    if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
    return this.toPublicUser(account)
  }

  async updateCurrentProfile(userId: string, profileId: string): Promise<AuthenticatedUser> {
    let updated: AccountRecord | undefined
    await this.repository.update<AccountRecord>('accounts', accounts => {
      const account = accounts.find(item => item.id === userId)
      if (!account || !account.profiles.includes(profileId)) {
        throw new UnauthorizedException('PROFILE_NOT_OWNED')
      }
      updated = { ...account, currentProfile: profileId }
      return accounts.map(item => item.id === userId ? updated! : item)
    })
    return this.toPublicUser(updated!)
  }

  async addProfile(userId: string, profileId: string, makeCurrent = false): Promise<AuthenticatedUser> {
    let updated: AccountRecord | undefined
    await this.repository.update<AccountRecord>('accounts', accounts => {
      const account = accounts.find(item => item.id === userId)
      if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
      updated = {
        ...account,
        profiles: account.profiles.includes(profileId) ? account.profiles : [...account.profiles, profileId],
        currentProfile: makeCurrent ? profileId : account.currentProfile ?? profileId
      }
      return accounts.map(item => item.id === userId ? updated! : item)
    })
    return this.toPublicUser(updated!)
  }

  async removeProfile(
    userId: string,
    profileId: string,
    previousCurrentProfileId: string | null = null
  ): Promise<void> {
    await this.repository.update<AccountRecord>('accounts', accounts => {
      const account = accounts.find(item => item.id === userId)
      if (!account || !account.profiles.includes(profileId)) return accounts

      const profiles = account.profiles.filter(id => id !== profileId)
      const currentProfile = account.currentProfile === profileId
        ? (previousCurrentProfileId && profiles.includes(previousCurrentProfileId)
          ? previousCurrentProfileId
          : profiles[0] ?? null)
        : account.currentProfile

      const updated = { ...account, profiles, currentProfile }
      return accounts.map(item => item.id === userId ? updated : item)
    })
  }

  async getPreferences(userId: string): Promise<UserPreferences> {
    const accounts = await this.repository.read<AccountRecord>('accounts')
    const account = accounts.find(item => item.id === userId)
    if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
    return account.preferences ?? { language: 'system', theme: 'system' }
  }

  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    let updated: AccountRecord | undefined
    await this.repository.update<AccountRecord>('accounts', accounts => {
      const account = accounts.find(item => item.id === userId)
      if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
      updated = {
        ...account,
        preferences: { language: 'system', theme: 'system', ...account.preferences, ...preferences }
      }
      return accounts.map(item => item.id === userId ? updated! : item)
    })
    return updated!.preferences!
  }

  async ownsProfile(userId: string, profileId: string): Promise<boolean> {
    const accounts = await this.repository.read<AccountRecord>('accounts')
    return accounts.some(item => item.id === userId && item.profiles.includes(profileId))
  }

  private toPublicUser(account: AccountRecord): AuthenticatedUser {
    return {
      id: account.id,
      email: account.email,
      profiles: [...account.profiles],
      currentProfile: account.currentProfile
    }
  }
}
