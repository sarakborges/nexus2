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
    const account = await this.readAccount(userId)
    if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
    return this.toPublicUser(account)
  }

  async updateCurrentProfile(userId: string, profileId: string): Promise<AuthenticatedUser> {
    if (this.repository.changeAccountProfile) {
      await this.changeAccountProfile({
        accountId: userId,
        profileId,
        action: 'select',
        makeCurrent: true,
        previousCurrentProfileId: null
      })
      return this.getUser(userId)
    }

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
    if (this.repository.changeAccountProfile) {
      await this.changeAccountProfile({
        accountId: userId,
        profileId,
        action: 'add',
        makeCurrent,
        previousCurrentProfileId: null
      })
      return this.getUser(userId)
    }

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
    if (this.repository.changeAccountProfile) {
      await this.changeAccountProfile({
        accountId: userId,
        profileId,
        action: 'remove',
        makeCurrent: false,
        previousCurrentProfileId
      })
      return
    }

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
    const account = await this.readAccount(userId)
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
    const account = await this.readAccount(userId)
    return Boolean(account?.profiles.includes(profileId))
  }

  private async changeAccountProfile(change: {
    accountId: string
    profileId: string
    action: 'select' | 'add' | 'remove'
    makeCurrent: boolean
    previousCurrentProfileId: string | null
  }): Promise<void> {
    try {
      await this.repository.changeAccountProfile!(change)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('PROFILE_NOT_OWNED')) {
        throw new UnauthorizedException('PROFILE_NOT_OWNED')
      }
      if (message.includes('ACCOUNT_NOT_FOUND')) {
        throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
      }
      if (message.includes('PROFILE_NOT_FOUND')) {
        throw new UnauthorizedException('PROFILE_NOT_FOUND')
      }
      throw error
    }
  }

  private async readAccount(userId: string): Promise<AccountRecord | undefined> {
    const [account] = await this.repository.readByIds<AccountRecord>('accounts', [userId])
    return account
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
