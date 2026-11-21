import type { AccountCredentialsRecord, AccountProfileChange, AccountRepositoryRecord, CreateAccountWithRefreshTokenWrite, RefreshTokenRotation, RefreshTokenWrite, UserPreferences } from '../repository.types'

export interface AccountRepository {
  getAccountById(id: string): Promise<AccountRepositoryRecord | null>
  accountOwnsProfile(userId: string, profileId: string): Promise<boolean>
  findAccountByEmail(email: string): Promise<AccountCredentialsRecord | null>
  consumeAuthRateLimit(keyHash: string, windowMs: number, maxRequests: number): Promise<boolean>
  createAccountWithRefreshToken(change: CreateAccountWithRefreshTokenWrite): Promise<void>
  updateAccountPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences>
  issueRefreshToken(
    record: RefreshTokenWrite,
    rotation: RefreshTokenRotation | null,
    now: number
  ): Promise<void>
  deleteRefreshTokenByHash(tokenHash: string): Promise<void>
  changeAccountProfile(change: AccountProfileChange): Promise<void>
  deleteAccount(userId: string, now: number): Promise<void>
}
