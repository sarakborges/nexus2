import type { DialogType } from '@/Types/Dialog.type'

import { IntoTheDigitalWorld028 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/028.dialog'
import { NpcGennai } from '@/GameData/Npcs/Gennai.npc'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'

export const IntoTheDigitalWorld027 = {
  speaker: {
    id: NpcGennai.id,
    name: NpcGennai.name,
    title: getTexts(NpcGennai.title),
    portrait: NpcGennai.portrait
  },

  text: getTexts('ITDW_027'),

  actions: [
    {
      id: 'ITDW_027_CONTINUE',

      text: getTexts('SCENES_CONTINUE_BUTTON'),

      onClick: () => {
        const { setDialog } = useDialogStore.getState()
        setDialog(IntoTheDigitalWorld028)
      }
    }
  ]
} satisfies DialogType
