import type { ProfileType } from '@/Types/Profile.type'

import { useProfileStore } from '@/Stores/Profile.store'

export const saveSession = (value: ProfileType) => {
  try {
    const { setProfile } = useProfileStore.getState()

    sessionStorage.setItem(`itdw_profile`, JSON.stringify(value))

    setProfile(value)
  } catch {
    console.warn(`Error saving session: itdw_profile`)
    console.warn(value)
  }
}
