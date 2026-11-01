import type { AuthenticatedUser, AuthSession, SignInCredentials, SignUpCredentials } from '@nexus/common'
import { api, getApiErrorCode } from '../Http/api'

export type AuthErrorCode = 'EMAIL_ALREADY_EXISTS' | 'INVALID_CREDENTIALS' | 'STORAGE_UNAVAILABLE' | 'CRYPTO_UNAVAILABLE' | 'NETWORK_ERROR'
export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode) { super(code); this.name = 'AuthError'; this.code = code }
}
type AuthResponse = { user: AuthenticatedUser; authenticated: true }
const toSession = (user: AuthenticatedUser): AuthSession => ({ user, authenticatedAt: Date.now() })
const AUTH_CODES = ['EMAIL_ALREADY_EXISTS', 'INVALID_CREDENTIALS', 'STORAGE_UNAVAILABLE', 'CRYPTO_UNAVAILABLE', 'NETWORK_ERROR'] as const
function toAuthError(error: unknown, fallback: AuthErrorCode): AuthError {
  const code = getApiErrorCode(error, fallback)
  return new AuthError(AUTH_CODES.includes(code as typeof AUTH_CODES[number]) ? code as AuthErrorCode : fallback)
}
function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) return false

  const user = value as Record<string, unknown>
  return typeof user.id === 'string'
    && typeof user.email === 'string'
    && Array.isArray(user.profiles)
    && user.profiles.every(profileId => typeof profileId === 'string')
    && (typeof user.currentProfile === 'string' || user.currentProfile === null)
}

export async function signInUser(credentials: SignInCredentials): Promise<AuthenticatedUser> {
  try { const { data } = await api.post<AuthResponse>('/auth/sign-in', credentials); return data.user }
  catch (error) { throw toAuthError(error, 'INVALID_CREDENTIALS') }
}
export async function signUpUser(credentials: SignUpCredentials): Promise<AuthenticatedUser> {
  try { const { data } = await api.post<AuthResponse>('/auth/sign-up', credentials); return data.user }
  catch (error) { throw toAuthError(error, 'NETWORK_ERROR') }
}
export async function getCurrentAuthSession(): Promise<AuthSession | null> {
  try {
    const { data } = await api.get<unknown>('/auth/me')
    if (typeof data !== 'object' || data === null || !('user' in data)) return null

    const user = (data as { user?: unknown }).user
    return isAuthenticatedUser(user) ? toSession(user) : null
  } catch {
    return null
  }
}
export async function refreshAuthSession(): Promise<AuthenticatedUser> {
  try { const { data } = await api.post<AuthResponse>('/auth/refresh'); return data.user }
  catch (error) { throw toAuthError(error, 'INVALID_CREDENTIALS') }
}
export async function setCurrentProfile(profileId: string): Promise<AuthenticatedUser> {
  try { const { data } = await api.post<{ user: AuthenticatedUser }>('/auth/current-profile', { profileId }); return data.user }
  catch { throw new AuthError('NETWORK_ERROR') }
}
export async function signOutUser(): Promise<void> {
  try { await api.post('/auth/sign-out') } catch { /* Session cookies are cleared by the BFF even when the API is unavailable. */ }
}
