import type { BaseDigimonType } from '@/Types/BaseDigimon.type'

import { AllAttacks } from '@/GameData/Attacks'

import { DIGIMON_ATTRIBUTES } from '@/Consts/Attributes.const'
import { DIGIMON_FIELDS } from '@/Consts/Fields.const'

export const DigimonKoromon: BaseDigimonType = {
  id: 'koromon',
  name: 'Koromon',
  portrait: 'digimon_portraits/koromon',
  picture: 'digimons/koromon',
  attribute: DIGIMON_ATTRIBUTES.na.id,
  equipmentsSlots: 1,

  attacks: {
    [AllAttacks.bubbles.id]: null,
    [AllAttacks.acidBubbles.id]: null,
    [AllAttacks.poisonBubbles.id]: null
  },

  fields: {
    [DIGIMON_FIELDS.dr.id]: null,
    [DIGIMON_FIELDS.vb.id]: null
  },

  description: `Koromon is a small Digimon with a pink, round body, large mouth, and floppy ears. They are very active and curious, though still physically weak. Instead of fighting directly, Koromon usually defends itself by blowing bubbles to scare or distract enemies. It is commonly portrayed as friendly, playful, and energetic.`,

  stats: {
    vit: 4,
    pow: 2,
    res: 4,
    tec: 6,
    agi: 4
  }
}
