import { api } from '../Http/api'
import type {
  CreateProfileInput,
  CreateProfileResult,
  PaginatedResult,
  PaginationParams,
  Profile
} from '@nexus/common'
import axios from 'axios'

export async function getProfiles(
  params: PaginationParams = {}
): Promise<PaginatedResult<Profile>> {
  const { data } = await api.get<PaginatedResult<Profile>>('/profiles', {
    params
  })
  return data
}
export async function getOwnedProfiles(
  params: PaginationParams = {}
): Promise<PaginatedResult<Profile>> {
  const { data } = await api.get<PaginatedResult<Profile>>('/profiles/owned', {
    params
  })
  return data
}
export async function getProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (!ids.length) return []
  const { data } = await api.get<Profile[]>('/profiles/ids', {
    params: { ids }
  })
  return data
}
export async function getProfileByUrl(url: string): Promise<Profile | null> {
  try {
    const { data } = await api.get<Profile>(
      `/profiles/by-url/${encodeURIComponent(url)}`
    )
    return data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null
    throw error
  }
}
export async function createUserProfile(
  input: CreateProfileInput
): Promise<CreateProfileResult> {
  const { data } = await api.post<CreateProfileResult>('/profiles', input)
  return data
}
export async function updateUserProfile(
  profileId: string,
  input: Omit<CreateProfileInput, 'type'>
): Promise<Profile> {
  const { data } = await api.put<Profile>(
    `/profiles/${encodeURIComponent(profileId)}`,
    input
  )
  return data
}
