import { DigimonDorimon } from './Dorimon.digimon'
import { DigimonKoromon } from './Koromon.digimon'

import type { BaseDigimonType } from '@/Types/BaseDigimon.type'

export const AllDigimons: Record<string, BaseDigimonType> = {
  dorimon: DigimonDorimon,
  koromon: DigimonKoromon
}
