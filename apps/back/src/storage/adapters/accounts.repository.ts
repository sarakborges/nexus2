import type { AccountProfileChange, AccountRepositoryRecord, CreateAccountWithRefreshTokenWrite, RefreshTokenRotation, RefreshTokenWrite, UserPreferences } from '../repository.types'
import { SupabaseRepositoryClient } from '../supabase-repository.client'
import type { AccountRepository } from '../contracts/accounts.repository.interface'

export class SupabaseAccountRepository extends SupabaseRepositoryClient implements AccountRepository {
  constructor(projectUrl: string, publishableKey: string, apiSecret: string) {
    super(projectUrl, publishableKey, apiSecret)
  }

  async getAccountById(id: string): Promise<AccountRepositoryRecord | null> {
    const rows = await this.selectRowsByValues('accounts', 'id', [id])
    const [account] = await this.readAccounts(rows)
    return (account as AccountRepositoryRecord | undefined) ?? null
  }

  async findAccountByEmail(email: string): Promise<AccountRepositoryRecord | null> {
    const rows = await this.selectRowsByField('accounts', 'email', 'eq.' + email)
    const [account] = await this.readAccounts(rows)
    return (account as AccountRepositoryRecord | undefined) ?? null
  }

  async consumeAuthRateLimit(keyHash: string, windowMs: number, maxRequests: number): Promise<boolean> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_consume_auth_rate_limit', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_key_hash: keyHash,
        p_window_ms: windowMs,
        p_max_requests: maxRequests
      })
    })
    await this.assertSuccess(response)
    const allowed: unknown = await response.json()
    if (typeof allowed !== 'boolean') {
      throw new Error('Supabase auth rate-limit RPC returned an invalid result.')
    }
    return allowed
  }

  async createAccountWithRefreshToken(change: CreateAccountWithRefreshTokenWrite): Promise<void> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_create_account_with_refresh_token', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_account_id: change.accountId,
        p_email: change.email,
        p_password_hash: change.passwordHash,
        p_password_salt: change.passwordSalt,
        p_refresh_token_id: change.refreshToken.id,
        p_refresh_token_hash: change.refreshToken.tokenHash,
        p_refresh_token_expires_at_ms: change.refreshToken.expiresAt,
        p_now_ms: change.now
      })
    })
    await this.assertSuccess(response)
  }

  async updateAccountPreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_update_account_preferences', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: userId,
        p_language: preferences.language ?? null,
        p_theme: preferences.theme ?? null
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (
      !Array.isArray(rows) || rows.length !== 1 ||
      !['system', 'pt-BR', 'en-US'].includes(String(rows[0]?.language)) ||
      !['system', 'light', 'dark'].includes(String(rows[0]?.theme))
    ) throw new Error('Supabase account preferences write returned an invalid result.')
    return {
      language: rows[0].language as UserPreferences['language'],
      theme: rows[0].theme as UserPreferences['theme']
    }
  }

  async issueRefreshToken(
    record: RefreshTokenWrite,
    rotation: RefreshTokenRotation | null,
    now: number
  ): Promise<void> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_issue_refresh_token', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_id: record.id,
        p_user_id: record.userId,
        p_token_hash: record.tokenHash,
        p_expires_at_ms: record.expiresAt,
        p_now_ms: now,
        p_previous_id: rotation?.id ?? null,
        p_previous_user_id: rotation?.userId ?? null,
        p_previous_token_hash: rotation?.tokenHash ?? null
      })
    })
    await this.assertSuccess(response)
  }

  async deleteRefreshTokenByHash(tokenHash: string): Promise<void> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_revoke_refresh_token', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_token_hash: tokenHash })
    })
    await this.assertSuccess(response)
  }

  async deleteAccount(userId: string, now: number): Promise<void> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_delete_account', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user_id: userId, p_now_ms: now })
    })
    await this.assertSuccess(response)
  }

  async changeAccountProfile(change: AccountProfileChange): Promise<void> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_change_account_profile', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_account_id: change.accountId,
        p_profile_id: change.profileId,
        p_action: change.action,
        p_make_current: change.makeCurrent,
        p_previous_current_profile_id: change.previousCurrentProfileId
      })
    })
    await this.assertSuccess(response)
  }
}
