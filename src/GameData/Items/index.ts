import { DigiviceItem } from './Digivice.item'
import { DorimonCoreItem } from './DorimonCore.item'
import { DragonsRoarCoreItem } from './DragonsRoarCore.item'
import { KoromonCoreItem } from './KoromonCore.item'
import { NatureSpiritsCoreItem } from './NatureSpiritsCore.item'
import { VirusBustersCoreItem } from './VirusBustersCore.item'

import type { ItemType } from '@/Types/Item.type'

export const AllItems: {
  [itemId: string]: ItemType
} = {
  [DigiviceItem.id]: DigiviceItem,

  [KoromonCoreItem.id]: KoromonCoreItem,
  [DorimonCoreItem.id]: DorimonCoreItem,

  [VirusBustersCoreItem.id]: VirusBustersCoreItem,
  [DragonsRoarCoreItem.id]: DragonsRoarCoreItem,
  [NatureSpiritsCoreItem.id]: NatureSpiritsCoreItem
}
