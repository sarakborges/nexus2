import { api } from '../Http/api'
import type {
  PaginatedResult,
  PaginationParams,
  ProfileMessage
} from '@nexus/common'

export type ProfileMessageErrorCode = 'INVALID_MESSAGE' | 'STORAGE_UNAVAILABLE'
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
    const message = (error as { response?: { data?: { message?: string } } })
      ?.response?.data?.message
    throw new ProfileMessageError(
      message === 'INVALID_MESSAGE' ? 'INVALID_MESSAGE' : 'STORAGE_UNAVAILABLE'
    )
  }
}
