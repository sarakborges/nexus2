import { useSavedProfilesStore } from '@/Stores/SavedProfiles.store'

export const getNewId = () => {
  const { savedProfiles } = useSavedProfilesStore.getState()

  const sortedProfiles = [...(savedProfiles || [])].sort(
    (a, b) => (b?.id || 0) - (a?.id || 0)
  )

  return (sortedProfiles?.[0]?.id ?? 0) + 1
}
