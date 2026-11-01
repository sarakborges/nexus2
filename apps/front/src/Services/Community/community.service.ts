import { loadData, saveData } from '@/Helpers/Systems/Data'
import type {
  Community,
  CreateCommunityInput
} from '@/Models/Community.model'
import type { ProfileType } from '@/Models/Profile.model'

const COMMUNITIES_KEY = 'communities'
const PROFILE_TYPES: ProfileType[] = ['social', 'rp', 'business']

export type CommunityErrorCode =
  | 'INVALID_COMMUNITY'
  | 'COMMUNITY_URL_ALREADY_IN_USE'
  | 'OWNER_PROFILE_REQUIRED'
  | 'STORAGE_UNAVAILABLE'

export class CommunityError extends Error {
  code: CommunityErrorCode

  constructor(code: CommunityErrorCode) {
    super(code)
    this.name = 'CommunityError'
    this.code = code
  }
}

const createId = (): string => {
  if (typeof globalThis.crypto === 'undefined') {
    throw new CommunityError('STORAGE_UNAVAILABLE')
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const normalizeUrl = (value: string): string =>
  value.trim().replace(/^@/, '').toLowerCase()

const isValidUrl = (value: string): boolean =>
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)

const isProfileType = (value: unknown): value is ProfileType =>
  typeof value === 'string' && PROFILE_TYPES.includes(value as ProfileType)

const parseCommunity = (value: unknown): Community | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const community = value as Record<string, unknown>

  if (
    typeof community.id !== 'string' ||
    typeof community.name !== 'string' ||
    typeof community.url !== 'string' ||
    typeof community.picture !== 'string' ||
    typeof community.about !== 'string' ||
    !isProfileType(community.type)
  ) {
    return null
  }

  return {
    id: community.id,
    name: community.name,
    url: normalizeUrl(community.url),
    picture: community.picture,
    about: community.about,
    type: community.type
  }
}

export const getCommunities = (): Community[] => {
  const storedCommunities = loadData<unknown>(COMMUNITIES_KEY)

  if (!Array.isArray(storedCommunities)) {
    return []
  }

  const communities = storedCommunities
    .map(parseCommunity)
    .filter((community): community is Community => community !== null)

  if (communities.length !== storedCommunities.length) {
    saveCommunities(communities)
  }

  return communities
}

export const getCommunitiesByIds = (ids: string[]): Community[] => {
  const idSet = new Set(ids)

  return getCommunities().filter((community) => idSet.has(community.id))
}

export const saveCommunities = (communities: Community[]): boolean =>
  saveData({ key: COMMUNITIES_KEY, value: communities })

export const getCommunityById = (id: string): Community | null =>
  getCommunities().find((community) => community.id === id) ?? null

export const getCommunityByUrl = (url: string): Community | null => {
  const normalizedUrl = normalizeUrl(url)

  return (
    getCommunities().find((community) => community.url === normalizedUrl) ??
    null
  )
}

export const createCommunity = (
  input: CreateCommunityInput,
  existingCommunities: Community[]
): Community => {
  const name = input.name.trim()
  const url = normalizeUrl(input.url)
  const picture = input.picture.trim()
  const about = input.about.trim()

  if (
    !name ||
    !isValidUrl(url) ||
    !isProfileType(input.type) ||
    (picture.length > 0 && !/^https?:\/\//i.test(picture))
  ) {
    throw new CommunityError('INVALID_COMMUNITY')
  }

  if (existingCommunities.some((item) => item.url === url)) {
    throw new CommunityError('COMMUNITY_URL_ALREADY_IN_USE')
  }

  return {
    id: createId(),
    name,
    url,
    picture,
    about,
    type: input.type
  }
}
