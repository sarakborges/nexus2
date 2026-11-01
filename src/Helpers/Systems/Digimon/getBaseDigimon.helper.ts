import type { BaseDigimonType } from '@/Types/BaseDigimon.type'
import type { PartnerDigimonType } from '@/Types/PartnerDigimon.type'

import { AllDigimons } from '@/GameData/Digimons'

import { useProfileStore } from '@/Stores/Profile.store'

export const getBaseDigimon = (
  digimonId: number | string
): BaseDigimonType | undefined => {
  const { profile } = useProfileStore.getState()

  const partner = profile.partnerDigimons?.[digimonId] as
    PartnerDigimonType | undefined

  if (!partner) {
    return undefined
  }

  return AllDigimons[partner.baseDigimon] as BaseDigimonType | undefined
}
