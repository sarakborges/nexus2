import { loadData } from '@/Helpers/Systems/Data'

import { useSavedProfilesStore } from '@/Stores/SavedProfiles.store'

export const loadProfiles = () => {
  const { setSavedProfiles } = useSavedProfilesStore.getState()

  const savedProfiles = loadData(`profiles`)

  if (!savedProfiles) {
    return
  }

  setSavedProfiles(
    savedProfiles
      ?.map((profile) => loadData(`profile${profile}`))
      .sort((a, b) => (a.lastSave > b.lastSave ? -1 : 1))
  )
}
