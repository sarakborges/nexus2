export type EquipmentType = {
  equipConditions?: () => boolean

  equipmentBonuses?: {
    stats?: {
      [statId: string]: {
        type: 'percentage' | 'fixed'
        amount: number
      }
    }
  }
}
