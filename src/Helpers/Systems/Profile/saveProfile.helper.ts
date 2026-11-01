import { loadData, saveData, saveSession } from '@/Helpers/Systems/Data'

import { useProfileStore } from '@/Stores/Profile.store'

export const saveProfile = () => {
  try {
    const { profile } = useProfileStore.getState()

    const updatedProfile = {
      ...profile,
      lastSave: new Date()
    }

    saveData({
      key: `profile${profile.id}`,
      value: updatedProfile
    })

    saveSession(updatedProfile)

    const updatedProfiles = Array.from(
      new Set([...(loadData('profiles') ?? []), profile.id])
    )

    saveData({
      key: 'profiles',
      value: updatedProfiles
    })
  } catch (e) {
    console.warn(e)
  }
}
