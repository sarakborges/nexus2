import {
  loadData,
  saveData
} from '@/Helpers/Systems/Data'
import { getBrowserStorage } from '@/Helpers/Systems/Storage'
import { addProfileToUser, getUserById } from '@/Services/Auth'
import type {
  CreateProfileInput,
  Profile,
  ProfileType
} from '@/Models/Profile.model'
import type { ProfileErrorCode } from '@/Types/Profile.type'

const PROFILES_KEY = 'profiles'
const LEGACY_PROFILE_PREFIX = 'nexus_profile_v1_'
const PROFILE_TYPES: ProfileType[] = ['social', 'rp', 'business']

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

const normalizeProfileUrl = (value: string): string =>
  value.trim().replace(/^@/, '').toLowerCase()

const isValidProfileUrl = (value: string): boolean =>
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)

const isProfileType = (value: unknown): value is ProfileType =>
  typeof value === 'string' && PROFILE_TYPES.includes(value as ProfileType)

const migrateProfile = (value: unknown): Profile | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const profile = value as Record<string, unknown>

  if (
    typeof profile.id !== 'string' ||
    typeof profile.name !== 'string' ||
    typeof profile.url !== 'string' ||
    typeof profile.picture !== 'string' ||
    typeof profile.about !== 'string'
  ) {
    return null
  }

  return {
    id: profile.id,
    name: profile.name,
    url: normalizeProfileUrl(profile.url),
    picture: profile.picture,
    about: profile.about,
    type: isProfileType(profile.type) ? profile.type : 'social'
  }
}

const readProfiles = (): Profile[] => {
  const storedProfiles = loadData<unknown>(PROFILES_KEY)

  if (!Array.isArray(storedProfiles)) {
    return []
  }

  const profiles = storedProfiles
    .map(migrateProfile)
    .filter((profile): profile is Profile => profile !== null)

  if (
    profiles.length !== storedProfiles.length ||
    storedProfiles.some((value) => {
      if (!value || typeof value !== 'object') {
        return true
      }

      return !isProfileType((value as Record<string, unknown>).type)
    })
  ) {
    saveData({ key: PROFILES_KEY, value: profiles })
  }

  return profiles
}

const migrateLegacyProfiles = (): Profile[] => {
  const profiles = readProfiles()
  const sessionStorage = getBrowserStorage('session')

  if (!sessionStorage) {
    return profiles
  }

  const legacyRecords: Array<{ userId: string; profile: Profile; key: string }> =
    []

  try {
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index)

      if (!key?.startsWith(LEGACY_PROFILE_PREFIX)) {
        continue
      }

      const serializedProfile = sessionStorage.getItem(key)

      if (!serializedProfile) {
        continue
      }

      const parsedProfile: unknown = JSON.parse(serializedProfile)
      const profile = migrateProfile(parsedProfile)

      if (!profile) {
        continue
      }

      let migratedUrl = normalizeProfileUrl(profile.url)

      if (!isValidProfileUrl(migratedUrl)) {
        try {
          const previousUrl = new URL(profile.url)
          const lastPathSegment = previousUrl.pathname
            .split('/')
            .filter(Boolean)
            .pop()
          const source =
            lastPathSegment || previousUrl.hostname.replace(/^www\./, '')

          migratedUrl = source
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
        } catch {
          migratedUrl = profile.id.toLowerCase()
        }
      }

      legacyRecords.push({
        userId: key.slice(LEGACY_PROFILE_PREFIX.length),
        profile: { ...profile, url: migratedUrl },
        key
      })
    }
  } catch (error) {
    console.warn('Unable to read legacy profiles from session storage.', error)
    return profiles
  }

  if (legacyRecords.length === 0) {
    return profiles
  }

  const migratedProfiles = [...profiles]

  for (const record of legacyRecords) {
    if (!migratedProfiles.some((profile) => profile.id === record.profile.id)) {
      migratedProfiles.push(record.profile)
    }
  }

  if (!saveData({ key: PROFILES_KEY, value: migratedProfiles })) {
    return profiles
  }

  for (const record of legacyRecords) {
    if (!addProfileToUser(record.userId, record.profile.id)) {
      return profiles
    }
  }

  for (const record of legacyRecords) {
    sessionStorage.removeItem(record.key)
  }

  return migratedProfiles
}

export const getProfiles = (): Profile[] => migrateLegacyProfiles()

export const getProfilesByIds = (profileIds: string[]): Profile[] => {
  const profileIdSet = new Set(profileIds)

  return getProfiles().filter((profile) => profileIdSet.has(profile.id))
}

export const getProfileById = (profileId: string): Profile | null =>
  getProfiles().find((profile) => profile.id === profileId) ?? null

export const getProfileByUrl = (url: string): Profile | null => {
  const normalizedUrl = normalizeProfileUrl(url)

  return (
    getProfiles().find(
      (profile) => normalizeProfileUrl(profile.url) === normalizedUrl
    ) ?? null
  )
}

export const createUserProfile = (
  userId: string,
  input: CreateProfileInput
): Profile => {
  if (!getUserById(userId)) {
    throw new ProfileError('STORAGE_UNAVAILABLE')
  }

  const name = input.name.trim()
  const url = normalizeProfileUrl(input.url)
  const picture = input.picture.trim()
  const about = input.about.trim()
  const type = input.type

  if (
    !name ||
    !isValidProfileUrl(url) ||
    !isProfileType(type) ||
    (picture.length > 0 && !/^https?:\/\//i.test(picture))
  ) {
    throw new ProfileError('INVALID_PROFILE')
  }

  const profiles = getProfiles()

  if (
    profiles.some(
      (profile) => normalizeProfileUrl(profile.url) === url
    )
  ) {
    throw new ProfileError('PROFILE_URL_ALREADY_IN_USE')
  }

  const profile: Profile = {
    id: createId(),
    name,
    url,
    picture,
    about,
    type
  }

  const updatedProfiles = [...profiles, profile]

  if (!saveData({ key: PROFILES_KEY, value: updatedProfiles })) {
    throw new ProfileError('STORAGE_UNAVAILABLE')
  }

  if (!addProfileToUser(userId, profile.id)) {
    saveData({ key: PROFILES_KEY, value: profiles })
    throw new ProfileError('STORAGE_UNAVAILABLE')
  }

  return profile
}
