import type { DialogType } from '@/Types/Dialog.type'

import { FashionFixComplete } from '@/GameData/Dialogs/Apps/Fashion/FixComplete.dialog'
import { FashionUpdateCancel } from '@/GameData/Dialogs/Apps/Fashion/UpdateCancel.dialog'
import { FashionUpdateComplete } from '@/GameData/Dialogs/Apps/Fashion/UpdateComplete.dialog'
import { NpcDressmon } from '@/GameData/Npcs/Dressmon.npc'

import { getTexts } from '@/Helpers/Language'

import { useAvatarCustomizationStore } from '@/Stores/AvatarCustomization.store'
import { useDialogStore } from '@/Stores/Dialog.store'
import { useProfileStore } from '@/Stores/Profile.store'

import { AvatarCustomization } from '@/Components/DialogContent/AvatarCustomization'

export const FashionApp = () => {
  const { profile } = useProfileStore.getState()

  return {
    speaker: {
      id: NpcDressmon.id,
      name: NpcDressmon.name,
      title: getTexts(NpcDressmon.title),
      portrait: NpcDressmon.picture
    },

    content: <AvatarCustomization />,

    actions: [
      {
        id: 'FASHION_APP_COMPLETE_CANCEL',

        text: getTexts('SCENES_CANCEL_BUTTON'),

        disabled: !profile.avatar,

        onClick: () => {
          const { setDialog } = useDialogStore.getState()
          setDialog(FashionUpdateCancel)
        }
      },

      {
        id: 'FASHION_APP_COMPLETE_CONFIRM',

        text: getTexts('SCENES_CONFIRM_BUTTON'),

        onClick: () => {
          const { setDialog } = useDialogStore.getState()
          const { profile, patchProfile } = useProfileStore.getState()
          const { avatar } = useAvatarCustomizationStore.getState()

          if (!profile || !avatar) {
            throw new Error('Missing profile or avatar')
          }

          setDialog(
            !profile.avatar ? FashionFixComplete : FashionUpdateComplete
          )

          setTimeout(() => patchProfile({ avatar }), 600)
        }
      }
    ]
  } satisfies DialogType
}
