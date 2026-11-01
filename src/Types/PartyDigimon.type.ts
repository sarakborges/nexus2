import type { BaseDigimonType } from '@/Types/BaseDigimon.type'

export type PartyDigimonType = BaseDigimonType & {
  party: 'allies' | 'enemies'
  index: number
  equipments: Array<string>
}
