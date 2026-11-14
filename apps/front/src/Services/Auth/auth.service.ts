import { api, getApiErrorCode } from '../Http/api'
import type {
  AuthMeResponse,
  AuthSession,
  AuthenticatedUser,
  ProfileSettings,
  SignInCredentials,
  SignUpCredentials
} from '@nexus/common'
import axios from 'axios'

export type AuthErrorCode =
  | 'EMAIL_ALREADY_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'STORAGE_UNAVAILABLE'
  | 'CRYPTO_UNAVAILABLE'
  | 'NETWORK_ERROR'
export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode) {
    super(code)
    this.name = 'AuthError'
    this.code = code
  }
}
type AuthResponse = { user: AuthenticatedUser; authenticated: true }
const toSession = (response: AuthMeResponse): AuthSession => ({
  ...response,
  authenticatedAt: Date.now()
})
const AUTH_CODES = [
  'EMAIL_ALREADY_EXISTS',
  'INVALID_CREDENTIALS',
  'STORAGE_UNAVAILABLE',
  'CRYPTO_UNAVAILABLE',
  'NETWORK_ERROR'
] as const
function toAuthError(error: unknown, fallback: AuthErrorCode): AuthError {
  const code = getApiErrorCode(error, fallback)
  return new AuthError(
    AUTH_CODES.includes(code as (typeof AUTH_CODES)[number])
      ? (code as AuthErrorCode)
      : fallback
  )
}
const PROFILE_ACTIVITY_TYPES = new Set([
  'friend_connected',
  'profile_post',
  'community_created',
  'community_membership'
])

function isProfileSettings(value: unknown): value is ProfileSettings {
  if (typeof value !== 'object' || value === null) return false
  const settings = value as Record<string, unknown>
  const isActivityList = (items: unknown): boolean =>
    Array.isArray(items) &&
    items.every(item => typeof item === 'string' && PROFILE_ACTIVITY_TYPES.has(item))

  return (
    (settings.messageAudience === 'friends' || settings.messageAudience === 'everyone') &&
    isActivityList(settings.publishActivityTypes) &&
    isActivityList(settings.showFriendActivityTypes)
  )
}

function isAuthMeResponse(value: unknown): value is AuthMeResponse {
  if (typeof value !== 'object' || value === null) return false
  const response = value as Record<string, unknown>
  const cursor = response.activityCursor
  const currentProfile = response.currentProfile
  const currentProfileSettings = response.currentProfileSettings
  const validProfileSettings = currentProfileSettings === null || isProfileSettings(currentProfileSettings)
  const validProfile = currentProfile === null ||
    (typeof currentProfile === 'object' && currentProfile !== null &&
      typeof (currentProfile as Record<string, unknown>).id === 'string')
  const validCursor = cursor === null ||
    (typeof cursor === 'object' && cursor !== null &&
      typeof (cursor as Record<string, unknown>).id === 'string' &&
      Number.isFinite((cursor as Record<string, unknown>).updatedAt))
  return (
    isAuthenticatedUser(response.user) &&
    validProfile &&
    Object.prototype.hasOwnProperty.call(response, 'currentProfileSettings') &&
    validProfileSettings &&
    Array.isArray(response.suggestedCommunities) &&
    Array.isArray(response.activities) &&
    validCursor &&
    typeof response.hasMoreActivities === 'boolean'
  )
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) return false
  const user = value as Record<string, unknown>
  return (
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    Array.isArray(user.profiles) &&
    user.profiles.every((profileId) => typeof profileId === 'string') &&
    (typeof user.currentProfile === 'string' || user.currentProfile === null)
  )
}

export async function signInUser(
  credentials: SignInCredentials
): Promise<AuthenticatedUser> {
  try {
    const { data } = await api.post<AuthResponse>('/auth/sign-in', credentials)
    return data.user
  } catch (error) {
    throw toAuthError(error, 'INVALID_CREDENTIALS')
  }
}
export async function signUpUser(
  credentials: SignUpCredentials
): Promise<AuthenticatedUser> {
  try {
    const { data } = await api.post<AuthResponse>('/auth/sign-up', credentials)
    return data.user
  } catch (error) {
    throw toAuthError(error, 'NETWORK_ERROR')
  }
}
export async function getCurrentAuthSession(): Promise<AuthSession | null> {
  try {
    const { data } = await api.get<unknown>('/auth/me')
    return isAuthMeResponse(data) ? toSession(data) : null
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      [401, 403].includes(error.response?.status ?? 0)
    )
      return null
    throw error
  }
}
export async function refreshAuthSession(): Promise<AuthenticatedUser> {
  try {
    const { data } = await api.post<AuthResponse>('/auth/refresh')
    return data.user
  } catch (error) {
    throw toAuthError(error, 'INVALID_CREDENTIALS')
  }
}
export async function setCurrentProfile(
  profileId: string
): Promise<AuthenticatedUser> {
  try {
    const { data } = await api.post<{ user: AuthenticatedUser }>(
      '/auth/current-profile',
      { profileId }
    )
    return data.user
  } catch {
    throw new AuthError('NETWORK_ERROR')
  }
}
export async function signOutUser(): Promise<void> {
  try {
    await api.post('/auth/sign-out')
  } catch {
    /* Session cookies are cleared by the BFF even when the API is unavailable. */
  }
}
