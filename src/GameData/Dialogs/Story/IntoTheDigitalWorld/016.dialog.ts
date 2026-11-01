import type { DialogType } from '@/Types/Dialog.type'

import { getIntoTheDigitalWorld017 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/017.dialog'
import { NpcGennai } from '@/GameData/Npcs/Gennai.npc'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'

export const IntoTheDigitalWorld016 = {
  speaker: {
    id: NpcGennai.id,
    name: NpcGennai.name,
    title: getTexts(NpcGennai.title),
    portrait: NpcGennai.portrait
  },

  text: getTexts('ITDW_016'),

  actions: [
    {
      id: 'ITDW_016_CONTINUE',

      text: getTexts('SCENES_CONTINUE_BUTTON'),

      onClick: () => {
        const { setDialog } = useDialogStore.getState()
        setDialog(getIntoTheDigitalWorld017())
      }
    }
  ]
} satisfies DialogType
