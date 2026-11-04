import { api } from '../Http/api'
import type { UserPreferences } from '@nexus/common'

export async function getUserPreferences(): Promise<UserPreferences> {
  const { data } = await api.get<UserPreferences>('/auth/preferences')
  return data
}

export async function saveUserPreferences(
  patch: Partial<UserPreferences>
): Promise<UserPreferences> {
  const { data } = await api.post<UserPreferences>('/auth/preferences', patch)
  return data
}
