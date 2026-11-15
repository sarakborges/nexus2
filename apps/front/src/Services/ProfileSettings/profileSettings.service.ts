import type { ProfileSettings } from '@nexus/common'
import { api } from '../Http/api'

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
