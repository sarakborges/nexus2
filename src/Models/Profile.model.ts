import type { ProfileType } from '@/Types/Profile.type'

import { AllNpcs } from '@/GameData/Npcs'

export const ProfileModel = {
  name: '',
  avatar: null,

  lastSave: new Date(),
  currentDialog: null,

  currentScene: null,

  currentTitle: 'chosenChild',
  titles: ['chosenChild'],

  npcAcquaintances: [...Object.keys(AllNpcs.appmon)]
} satisfies ProfileType
