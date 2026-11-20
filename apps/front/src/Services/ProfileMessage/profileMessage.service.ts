import { api, getApiErrorCode } from '../Http/api'
import type {
  PaginatedResult,
  PaginationParams,
  ProfileMessage
} from '@nexus/common'

export type ProfileMessageErrorCode =
  | 'INVALID_MESSAGE'
  | 'PROFILE_MESSAGE_FRIENDS_ONLY'
  | 'PROFILE_TYPE_MISMATCH'
  | 'PROFILE_NOT_OWNED'
  | 'PROFILE_NOT_FOUND'
  | 'INVALID_EDITOR_IMAGE'
  | 'EDITOR_IMAGE_ALREADY_ATTACHED'
  | 'STORAGE_UNAVAILABLE'
export class ProfileMessageError extends Error {
  code: ProfileMessageErrorCode
  constructor(code: ProfileMessageErrorCode) {
    super(code)
    this.name = 'ProfileMessageError'
    this.code = code
  }
}
export async function getProfileMessages(
  profileId: string,
  params: PaginationParams = {}
): Promise<PaginatedResult<ProfileMessage>> {
  const { data } = await api.get<PaginatedResult<ProfileMessage>>(
    `/profiles/${encodeURIComponent(profileId)}/messages`,
    { params }
  )
  return data
}
export async function createProfileMessage(
  fromProfileId: string,
  toProfileId: string,
  content: string
): Promise<ProfileMessage> {
  try {
    const { data } = await api.post<ProfileMessage>(
      `/profiles/${encodeURIComponent(toProfileId)}/messages`,
      { fromProfileId, content }
    )
    return data
  } catch (error) {
    const code = getApiErrorCode(error, 'STORAGE_UNAVAILABLE')
    const knownCodes = new Set<ProfileMessageErrorCode>([
      'INVALID_MESSAGE',
      'PROFILE_MESSAGE_FRIENDS_ONLY',
      'PROFILE_TYPE_MISMATCH',
      'PROFILE_NOT_OWNED',
      'PROFILE_NOT_FOUND',
      'INVALID_EDITOR_IMAGE',
      'EDITOR_IMAGE_ALREADY_ATTACHED'
    ])
    throw new ProfileMessageError(
      knownCodes.has(code as ProfileMessageErrorCode)
        ? code as ProfileMessageErrorCode
        : 'STORAGE_UNAVAILABLE'
    )
  }
}

export async function deleteProfileMessage(
  recipientProfileId: string,
  messageId: string,
  actorProfileId: string
): Promise<void> {
  await api.delete(
    `/profiles/${encodeURIComponent(recipientProfileId)}/messages/${encodeURIComponent(messageId)}`,
    { data: { actorProfileId } }
  )
}

export async function setProfileMessageFavorite(
  recipientProfileId: string,
  messageId: string,
  actorProfileId: string,
  isFavorite: boolean
): Promise<ProfileMessage> {
  const { data } = await api.put<ProfileMessage>(
    `/profiles/${encodeURIComponent(recipientProfileId)}/messages/${encodeURIComponent(messageId)}/favorite`,
    { actorProfileId, isFavorite }
  )
  return data
}
