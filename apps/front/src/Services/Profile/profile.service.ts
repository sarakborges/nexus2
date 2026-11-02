import axios from 'axios'
import type { CreateProfileInput, PaginatedResult, PaginationParams, Profile } from '@nexus/common'
import { api } from '../Http/api'

export async function getProfiles(params: PaginationParams = {}): Promise<PaginatedResult<Profile>> {
  const { data } = await api.get<PaginatedResult<Profile>>('/profiles', { params })
  return data
}
export async function getOwnedProfiles(params: PaginationParams = {}): Promise<PaginatedResult<Profile>> {
  const { data } = await api.get<PaginatedResult<Profile>>('/profiles/owned', { params })
  return data
}
export async function getProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (!ids.length) return []
  const { data } = await api.get<Profile[]>('/profiles/ids', { params: { ids } })
  return data
}
export async function getProfileByUrl(url: string): Promise<Profile | null> {
  try {
    const { data } = await api.get<Profile>(`/profiles/by-url/${encodeURIComponent(url)}`)
    return data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null
    throw error
  }
}
export async function updateUserProfile(profileId: string, input: CreateProfileInput): Promise<Profile> {
  const { data } = await api.patch<Profile>('/profiles/' + encodeURIComponent(profileId), input)
  return data
}
export async function createUserProfile(input: CreateProfileInput): Promise<Profile> {
  const { data } = await api.post<Profile>('/profiles', input)
  return data
}
