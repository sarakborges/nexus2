import type { DialogType } from '@/Types/Dialog.type'

import { NpcDressmon } from '@/GameData/Npcs/Dressmon.npc'

import { getTexts } from '@/Helpers/Language'
import { setProfileAvatar } from '@/Helpers/Systems/Profile/setProfileAvatar.helper'

import { useDialogStore } from '@/Stores/Dialog.store'

export const FashionFixComplete = {
  speaker: {
    id: NpcDressmon.id,
    name: NpcDressmon.name,
    title: getTexts(NpcDressmon.title),
    portrait: NpcDressmon.picture
  },

  text: getTexts('FASHION_FIX_COMPLETE'),

  actions: [
    {
      id: 'FASHION_FIX_COMPLETE_CONTINUE',

      text: getTexts('SCENES_CONTINUE_BUTTON'),

      onClick: () => {
        const { setDialog } = useDialogStore.getState()
        setDialog(null)

        setProfileAvatar()
      }
    }
  ]
} satisfies DialogType
