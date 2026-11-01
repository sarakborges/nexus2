import type { DialogType } from '@/Types/Dialog.type'

import { FashionPlaceholder } from '@/GameData/Dialogs/Apps/Fashion/Placeholder.dialog'
import { NpcDressmon } from '@/GameData/Npcs/Dressmon.npc'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'

export const FashionIntroduction = {
  speaker: {
    id: NpcDressmon.id,
    name: NpcDressmon.name,
    title: getTexts(NpcDressmon.title)
  },

  image: {
    src: NpcDressmon.picture,
    alt: NpcDressmon.name
  },

  text: getTexts('FASHION_INTRODUCTION'),

  actions: [
    {
      id: 'FASHION_INTRODUCTION_CONTINUE',

      text: getTexts('SCENES_CONTINUE_BUTTON'),

      onClick: () => {
        const { setDialog } = useDialogStore.getState()
        setDialog(FashionPlaceholder)
      }
    }
  ]
} satisfies DialogType
