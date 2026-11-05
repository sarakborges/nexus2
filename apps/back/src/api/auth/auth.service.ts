import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { createHash, randomBytes, randomUUID, pbkdf2, timingSafeEqual } from 'node:crypto'
import type { AuthenticatedUser, AuthTokenPair, SignInCredentials, SignUpCredentials, UserPreferences } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type {
  AccountRecord,
  JwtPayload,
  RefreshRotation,
  RefreshTokenRecord,
  TokenIssueContext
} from './auth.types'

@Injectable()
export class AuthService {
  private readonly accessTtl: number
  private readonly refreshTtl: number

  constructor(
    @Inject(DATA_REPOSITORY) private readonly repository: DataRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {
    this.accessTtl = Number(config.get('JWT_ACCESS_TTL_SECONDS') ?? 900)
    this.refreshTtl = Number(config.get('JWT_REFRESH_TTL_SECONDS') ?? 2592000)
  }

  async signUp(credentials: SignUpCredentials): Promise<AuthTokenPair> {
    const email = this.normalizeEmail(credentials.email)
    const salt = randomBytes(16)
    const passwordHash = await this.hashPassword(credentials.password, salt)
    const account: AccountRecord = {
      id: randomUUID(),
      email,
      password: { salt: salt.toString('base64'), hash: passwordHash.toString('base64') },
      profiles: [],
      currentProfile: null
    }

    return this.issueTokens(account, { kind: 'sign-up' })
  }

  async signIn(credentials: SignInCredentials): Promise<AuthTokenPair> {
    const email = this.normalizeEmail(credentials.email)
    const accounts = await this.repository.read<AccountRecord>('accounts')
    const account = accounts.find(item => item.email === email)
    if (!account || !(await this.verifyPassword(credentials.password, account))) {
      throw new UnauthorizedException('INVALID_CREDENTIALS')
    }
    return this.issueTokens(account, { kind: 'sign-in' })
  }

  async refresh(token: string): Promise<AuthTokenPair> {
    if (!token) throw new UnauthorizedException('REFRESH_TOKEN_MISSING')

    let payload: JwtPayload
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET')
      })
    } catch {
      throw new UnauthorizedException('REFRESH_TOKEN_INVALID')
    }

    if (payload.type !== 'refresh' || !payload.sub || !payload.jti) {
      throw new UnauthorizedException('REFRESH_TOKEN_INVALID')
    }

    const accounts = await this.repository.read<AccountRecord>('accounts')
    const account = accounts.find(item => item.id === payload.sub)
    if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')

    return this.issueTokens(account, {
      kind: 'refresh',
      rotation: {
        id: payload.jti,
        userId: payload.sub,
        tokenHash: this.hashToken(token)
      }
    })
  }

  async signOut(token?: string): Promise<void> {
    if (!token) return
    const hash = this.hashToken(token)
    await this.repository.update<RefreshTokenRecord>('refresh_tokens', records =>
      records.filter(item => item.tokenHash !== hash)
    )
  }

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

  private async issueTokens(
    account: AccountRecord,
    context: TokenIssueContext
  ): Promise<AuthTokenPair> {
    const accessPayload: JwtPayload = { sub: account.id, email: account.email, type: 'access' }
    const jti = randomUUID()
    const refreshPayload: JwtPayload = { sub: account.id, email: account.email, type: 'refresh', jti }
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: this.accessTtl
    })
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.refreshTtl
    })

    const now = Date.now()
    const nextRecord: RefreshTokenRecord = {
      id: jti,
      userId: account.id,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: now + this.refreshTtl * 1000
    }
    const rotation = context.kind === 'refresh' ? context.rotation : undefined
    const rotateRecords = (records: RefreshTokenRecord[]): RefreshTokenRecord[] => {
      if (rotation) {
        const previous = records.find(item =>
          item.id === rotation.id &&
          item.userId === rotation.userId &&
          item.tokenHash === rotation.tokenHash &&
          item.expiresAt > now
        )
        if (!previous) throw new UnauthorizedException('REFRESH_TOKEN_REVOKED')
      }

      return [
        ...records.filter(record =>
          record.expiresAt > now && (!rotation || record.id !== rotation.id)
        ),
        nextRecord
      ]
    }

    if (context.kind === 'sign-up') {
      await this.repository.transaction(
        ['accounts', 'refresh_tokens'],
        collections => {
          const accounts = collections.accounts as AccountRecord[]
          if (accounts.some(existing => existing.email === account.email)) {
            throw new ConflictException('EMAIL_ALREADY_EXISTS')
          }

          return {
            records: {
              ...collections,
              accounts: [...accounts, account],
              refresh_tokens: rotateRecords(collections.refresh_tokens as RefreshTokenRecord[])
            },
            result: undefined
          }
        }
      )
    } else {
      await this.repository.update<RefreshTokenRecord>('refresh_tokens', rotateRecords)
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTtl,
      user: this.toPublicUser(account)
    }
  }

  private toPublicUser(account: AccountRecord): AuthenticatedUser {
    return {
      id: account.id,
      email: account.email,
      profiles: [...account.profiles],
      currentProfile: account.currentProfile
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  private hashPassword(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      pbkdf2(password, salt, 310000, 32, 'sha256', (error, derivedKey) => {
        if (error) reject(error)
        else resolve(derivedKey)
      })
    })
  }

  private async verifyPassword(password: string, account: AccountRecord): Promise<boolean> {
    try {
      const actual = await this.hashPassword(password, Buffer.from(account.password.salt, 'base64'))
      const expected = Buffer.from(account.password.hash, 'base64')
      return actual.length === expected.length && timingSafeEqual(actual, expected)
    } catch {
      return false
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}
