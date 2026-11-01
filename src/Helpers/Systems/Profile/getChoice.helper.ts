import { useProfileStore } from '@/Stores/Profile.store'

export const getChoice = (choice: string) => {
  const { profile } = useProfileStore.getState()
  return profile.meaningfulChoices?.[choice]
}
