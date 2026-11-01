import type { ProfileType } from '@/Types/Profile.type'

export const getSortedProfiles = (
  profiles: Array<ProfileType>
): Array<ProfileType> => {
  return profiles.sort((a, b) => (a.lastSave > b.lastSave ? -1 : 1))
}
