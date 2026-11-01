import type { DialogType } from '@/Types/Dialog.type'

import { IntoTheDigitalWorld021 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/021.dialog'
import { NpcGennai } from '@/GameData/Npcs/Gennai.npc'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'
import { useProfileStore } from '@/Stores/Profile.store'

export const IntoTheDigitalWorld020 = (): DialogType => {
  const { profile } = useProfileStore.getState()

  const choice =
    profile.meaningfulChoices?.['INTO_THE_DIGITAL_WORLD_NAME_REACTION']

  if (!choice) {
    throw new Error('Missing INTO_THE_DIGITAL_WORLD_NAME_REACTION choice')
  }

  return {
    speaker: {
      id: NpcGennai.id,
      name: NpcGennai.name,
      title: getTexts(NpcGennai.title),
      portrait: NpcGennai.portrait
    },

    text: getTexts(`ITDW_020_${choice.toUpperCase()}`, {
      '[NAME]': profile.name
    }),

    actions: [
      {
        id: 'ITDW_020_CONTINUE',

        text: getTexts('SCENES_CONTINUE_BUTTON'),

        onClick: () => {
          const { setDialog } = useDialogStore.getState()
          setDialog(IntoTheDigitalWorld021())
        }
      }
    ]
  }
}
