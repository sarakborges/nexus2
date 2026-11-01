import type { DialogType } from '@/Types/Dialog.type'

import { IntoTheDigitalWorld009 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/009.dialog'
import { NpcGennai } from '@/GameData/Npcs/Gennai.npc'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'

export const IntoTheDigitalWorld008 = {
  speaker: {
    id: NpcGennai.id,
    name: NpcGennai.name,
    title: getTexts(NpcGennai.title),
    portrait: NpcGennai.portrait
  },

  text: getTexts('ITDW_008'),

  actions: [
    {
      id: 'ITDW_008_CONTINUE',

      text: getTexts('SCENES_CONTINUE_BUTTON'),

      onClick: () => {
        const { setDialog } = useDialogStore.getState()
        setDialog(IntoTheDigitalWorld009)
      }
    }
  ]
} satisfies DialogType
