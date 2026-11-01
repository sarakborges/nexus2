import { useProfileStore } from '@/Stores/Profile.store'

export const setMeaningfulChoice = ({
  choice,
  value
}: {
  choice: string
  value: string
}) => {
  const { profile, patchProfile } = useProfileStore.getState()

  patchProfile({
    meaningfulChoices: {
      ...profile.meaningfulChoices,
      [choice]: value
    }
  })
}
