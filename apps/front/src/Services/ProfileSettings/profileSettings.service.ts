import type { ProfileSettings } from '@nexus/common'
import { api } from '../Http/api'

export async function getProfileSettings(profileId: string): Promise<ProfileSettings> {
  const { data } = await api.get<ProfileSettings>(
    '/profiles/' + encodeURIComponent(profileId) + '/settings'
  )
  return data
}

export async function saveProfileSettings(
  profileId: string,
  settings: ProfileSettings
): Promise<ProfileSettings> {
  const { data } = await api.put<ProfileSettings>(
    '/profiles/' + encodeURIComponent(profileId) + '/settings',
    settings
  )
  return data
}
