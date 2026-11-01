import type { AvatarType } from '@/Types/Avatar.type'
import type { DialogType } from '@/Types/Dialog.type'
import type { PartnerDigimonType } from '@/Types/PartnerDigimon.type'

export type ProfileType = {
  id?: number
  name: string
  avatar: AvatarType | null
  lastSave: Date

  currentTitle: string
  currentDialog: DialogType | null
  currentScene: string | null
  lastScene?: string | null

  titles: Array<string>
  npcAcquaintances: Array<string>
  party?: Array<number>

  items?: {
    [itemId: string]: number
  }

  partnerDigimons?: {
    [key: string]: PartnerDigimonType
  }

  meaningfulChoices?: {
    [key: string]: string
  }
}
