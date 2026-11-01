import type { DialogType } from '@/Types/Dialog.type'

import { getTexts } from '@/Helpers/Language'

import { useProfileStore } from '@/Stores/Profile.store'

import { SayNameReaction } from '@/Components/DialogContent/SayNameReaction'

export const getIntoTheDigitalWorld010 = (): DialogType => {
  const { profile } = useProfileStore.getState()

  return {
    text: getTexts('ITDW_010', {
      '[NAME]': profile.name
    }),

    content: <SayNameReaction />
  }
}
