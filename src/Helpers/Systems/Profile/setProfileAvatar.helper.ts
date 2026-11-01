import { saveSession } from '@/Helpers/Systems/Data'

import { useAvatarCustomizationStore } from '@/Stores/AvatarCustomization.store'
import { useProfileStore } from '@/Stores/Profile.store'

export const setProfileAvatar = () => {
  const { avatar } = useAvatarCustomizationStore.getState()
  const { profile } = useProfileStore.getState()

  if (!profile || !avatar) {
    throw new Error('Missing profile or avatar')
  }

  saveSession({
    ...profile,
    avatar
  })
}
