import { ProfileModel } from '@/Models/Profile.model'

import { IntoTheDigitalWorld001 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/001.dialog'

import { loadGame } from '@/Helpers/Systems/Game'
import { getNewId } from '@/Helpers/Systems/Profile'

import { useDialogStore } from '@/Stores/Dialog.store'
import { useProfileStore } from '@/Stores/Profile.store'

export const createNewProfile = () => {
  const { setProfile } = useProfileStore.getState()
  const { setDialog } = useDialogStore.getState()

  setProfile({ ...ProfileModel, id: getNewId() })
  loadGame()

  setDialog(IntoTheDigitalWorld001)
}
