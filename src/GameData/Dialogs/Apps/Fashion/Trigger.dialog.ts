import type { DialogType } from '@/Types/Dialog.type'

import { FashionApp } from '@/GameData/Dialogs/Apps/Fashion/App.dialog'
import { NpcDressmon } from '@/GameData/Npcs/Dressmon.npc'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'

export const FashionTrigger = {
  speaker: {
    id: NpcDressmon.id,
    name: NpcDressmon.name,
    title: getTexts(NpcDressmon.title),
    portrait: NpcDressmon.picture
  },

  text: getTexts('FASHION_TRIGGER'),

  actions: [
    {
      id: 'FASHION_TRIGGER_CONTINUE',

      text: getTexts('SCENES_CONTINUE_BUTTON'),

      onClick: () => {
        const { setDialog } = useDialogStore.getState()
        setDialog(FashionApp())
      }
    }
  ]
} satisfies DialogType
