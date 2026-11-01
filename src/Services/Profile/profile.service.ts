import { loadSession, saveSession } from '@/Helpers/Systems/Data'
import type { CreateProfileInput, Profile } from '@/Models/Profile.model'
import type { ProfileErrorCode } from '@/Types/Profile.type'

const PROFILE_STORAGE_PREFIX = 'profile_v1_'

export class ProfileError extends Error {
  code: ProfileErrorCode

  constructor(code: ProfileErrorCode) {
    super(code)
    this.name = 'ProfileError'
    this.code = code
  }
}

const createId = (): string => {
  if (typeof globalThis.crypto === 'undefined') {
    throw new ProfileError('STORAGE_UNAVAILABLE')
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const getProfileStorageKey = (userId: string): string =>
  `${PROFILE_STORAGE_PREFIX}${userId}`

const isProfile = (value: unknown): value is Profile => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const profile = value as Record<string, unknown>

  return (
    typeof profile.id === 'string' &&
    typeof profile.name === 'string' &&
    typeof profile.url === 'string' &&
    typeof profile.picture === 'string' &&
    typeof profile.about === 'string'
  )
}

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value)

    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export const getUserProfile = (userId: string): Profile | null => {
  const storedProfile = loadSession<unknown>(getProfileStorageKey(userId))

  return isProfile(storedProfile) ? storedProfile : null
}

export const createUserProfile = (
  userId: string,
  input: CreateProfileInput
): Profile => {
  if (getUserProfile(userId)) {
    throw new ProfileError('PROFILE_ALREADY_EXISTS')
  }

  const name = input.name.trim()
  const url = input.url.trim()
  const picture = input.picture.trim()
  const about = input.about.trim()

  if (
    !name ||
    !url ||
    !isHttpUrl(url) ||
    (picture.length > 0 && !isHttpUrl(picture))
  ) {
    throw new ProfileError('INVALID_PROFILE')
  }

  const profile: Profile = {
    id: createId(),
    name,
    url,
    picture,
    about
  }

  if (!saveSession({ key: getProfileStorageKey(userId), value: profile })) {
    throw new ProfileError('STORAGE_UNAVAILABLE')
  }

  return profile
}
