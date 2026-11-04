import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { createHash, randomBytes, randomUUID, pbkdf2Sync, timingSafeEqual } from 'node:crypto'
import type { AuthenticatedUser, AuthTokenPair, SignInCredentials, SignUpCredentials, UserPreferences } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord, JwtPayload, RefreshTokenRecord } from './auth.types'

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
    const accounts = await this.repository.read<AccountRecord>('accounts')
    if (accounts.some((account) => account.email === email)) throw new ConflictException('EMAIL_ALREADY_EXISTS')
    const salt = randomBytes(16)
    const account: AccountRecord = {
      id: randomUUID(), email,
      password: { salt: salt.toString('base64'), hash: this.hashPassword(credentials.password, salt).toString('base64') },
      profiles: [], currentProfile: null
    }
    await this.repository.write('accounts', [...accounts, account])
    return this.issueTokens(account)
  }
  async signIn(credentials: SignInCredentials): Promise<AuthTokenPair> {
    const email = this.normalizeEmail(credentials.email)
    const accounts = await this.repository.read<AccountRecord>('accounts')
    const account = accounts.find((item) => item.email === email)
    if (!account || !this.verifyPassword(credentials.password, account)) throw new UnauthorizedException('INVALID_CREDENTIALS')
    return this.issueTokens(account)
  }
  async refresh(token: string): Promise<AuthTokenPair> {
    if (!token) throw new UnauthorizedException('REFRESH_TOKEN_MISSING')
    let payload: JwtPayload
    try { payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret: this.config.getOrThrow('JWT_REFRESH_SECRET') }) }
    catch { throw new UnauthorizedException('REFRESH_TOKEN_INVALID') }
    if (payload.type !== 'refresh' || !payload.sub || !payload.jti) throw new UnauthorizedException('REFRESH_TOKEN_INVALID')
    const records = await this.repository.read<RefreshTokenRecord>('refresh_tokens')
    const tokenHash = this.hashToken(token)
    const stored = records.find((item) => item.id === payload.jti && item.userId === payload.sub && item.tokenHash === tokenHash && item.expiresAt > Date.now())
    if (!stored) throw new UnauthorizedException('REFRESH_TOKEN_REVOKED')
    const accounts = await this.repository.read<AccountRecord>('accounts')
    const account = accounts.find((item) => item.id === payload.sub)
    if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
    await this.repository.write('refresh_tokens', records.filter((item) => item.id !== stored.id))
    return this.issueTokens(account)
  }
  async signOut(token?: string): Promise<void> {
    if (!token) return
    const records = await this.repository.read<RefreshTokenRecord>('refresh_tokens')
    const hash = this.hashToken(token)
    await this.repository.write('refresh_tokens', records.filter((item) => item.tokenHash !== hash))
  }
  async getUser(userId: string): Promise<AuthenticatedUser> {
    const accounts = await this.repository.read<AccountRecord>('accounts')
    const account = accounts.find((item) => item.id === userId)
    if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
    return this.toPublicUser(account)
  }
  async updateCurrentProfile(userId: string, profileId: string): Promise<AuthenticatedUser> {
    const accounts = await this.repository.read<AccountRecord>('accounts')
    const account = accounts.find((item) => item.id === userId)
    if (!account || !account.profiles.includes(profileId)) throw new UnauthorizedException('PROFILE_NOT_OWNED')
    const updated = { ...account, currentProfile: profileId }
    await this.repository.write('accounts', accounts.map((item) => item.id === userId ? updated : item))
    return this.toPublicUser(updated)
  }
  async addProfile(userId: string, profileId: string): Promise<AuthenticatedUser> {
    const accounts = await this.repository.read<AccountRecord>('accounts')
    const account = accounts.find((item) => item.id === userId)
    if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
    const updated = { ...account, profiles: account.profiles.includes(profileId) ? account.profiles : [...account.profiles, profileId], currentProfile: account.currentProfile ?? profileId }
    await this.repository.write('accounts', accounts.map((item) => item.id === userId ? updated : item))
    return this.toPublicUser(updated)
  }
  async removeProfile(userId: string, profileId: string, previousCurrentProfileId: string | null = null): Promise<void> {
    const accounts = await this.repository.read<AccountRecord>('accounts')
    const account = accounts.find((item) => item.id === userId)
    if (!account || !account.profiles.includes(profileId)) return

    const profiles = account.profiles.filter((id) => id !== profileId)
    const currentProfile = account.currentProfile === profileId
      ? (previousCurrentProfileId && profiles.includes(previousCurrentProfileId) ? previousCurrentProfileId : profiles[0] ?? null)
      : account.currentProfile

    const updated = { ...account, profiles, currentProfile }
    await this.repository.write('accounts', accounts.map((item) => item.id === userId ? updated : item))
  }
  async getPreferences(userId: string): Promise<UserPreferences> {
    const accounts = await this.repository.read<AccountRecord>('accounts')
    const account = accounts.find((item) => item.id === userId)
    if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
    return account.preferences ?? { language: 'system', theme: 'system' }
  }
  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    const accounts = await this.repository.read<AccountRecord>('accounts')
    const account = accounts.find((item) => item.id === userId)
    if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
    const updated: AccountRecord = {
      ...account,
      preferences: { language: 'system', theme: 'system', ...account.preferences, ...preferences }
    }
    await this.repository.write('accounts', accounts.map((item) => item.id === userId ? updated : item))
    return updated.preferences!
  }
  async ownsProfile(userId: string, profileId: string): Promise<boolean> {
    const accounts = await this.repository.read<AccountRecord>('accounts')
    return accounts.some((item) => item.id === userId && item.profiles.includes(profileId))
  }
  private async issueTokens(account: AccountRecord): Promise<AuthTokenPair> {
    const accessPayload: JwtPayload = { sub: account.id, email: account.email, type: 'access' }
    const jti = randomUUID()
    const refreshPayload: JwtPayload = { sub: account.id, email: account.email, type: 'refresh', jti }
    const accessToken = await this.jwt.signAsync(accessPayload, { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: this.accessTtl })
    const refreshToken = await this.jwt.signAsync(refreshPayload, { secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), expiresIn: this.refreshTtl })
    const records = await this.repository.read<RefreshTokenRecord>('refresh_tokens')
    records.push({ id: jti, userId: account.id, tokenHash: this.hashToken(refreshToken), expiresAt: Date.now() + this.refreshTtl * 1000 })
    await this.repository.write('refresh_tokens', records)
    return { accessToken, refreshToken, expiresIn: this.accessTtl, user: this.toPublicUser(account) }
  }
  private toPublicUser(account: AccountRecord): AuthenticatedUser {
    return { id: account.id, email: account.email, profiles: [...account.profiles], currentProfile: account.currentProfile }
  }
  private normalizeEmail(email: string): string { return email.trim().toLowerCase() }
  private hashPassword(password: string, salt: Buffer): Buffer { return pbkdf2Sync(password, salt, 310000, 32, 'sha256') }
  private verifyPassword(password: string, account: AccountRecord): boolean {
    try {
      const actual = this.hashPassword(password, Buffer.from(account.password.salt, 'base64'))
      const expected = Buffer.from(account.password.hash, 'base64')
      return actual.length === expected.length && timingSafeEqual(actual, expected)
    } catch { return false }
  }
  private hashToken(token: string): string { return createHash('sha256').update(token).digest('hex') }
}
