export type BaseDigimonType = {
  id: string
  name: string
  description: string
  portrait: string
  picture: string
  equipmentsSlots?: number

  attribute: 'va' | 'vi' | 'da' | 'na'

  fields: {
    [familyId: string]: null
  }

  attacks: {
    [attackId: string]: null
  }

  stats: {
    vit: number
    pow: number
    res: number
    tec: number
    agi: number
  }
}
