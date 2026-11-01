import { NpcAddmon } from './Addmon.npc'
import { NpcBookmon } from './Bookmon.npc'
import { NpcConsulmon } from './Consulmon.npc'
import { NpcDorimon } from './Dorimon.npc'
import { NpcDressmon } from './Dressmon.npc'
import { NpcGennai } from './Gennai.npc'
import { NpcJijimon } from './Jijimon.npc'
import { NpcLogamon } from './Logamon.npc'
import { NpcMirrormon } from './Mirrormon.npc'
import { NpcNanomon } from './Nanomon.npc'
import { NpcNavimon } from './Navimon.npc'
import { NpcOujamon } from './Oujamon.npc'
import { NpcSavemon } from './Savemon.npc'

import type { NpcType } from '@/Types/Npc.type'

export const AllNpcs: {
  [category: string]: {
    [npcId: string]: NpcType
  }
} = {
  general: {
    gennai: NpcGennai
  },

  digimon: {
    dorimon: NpcDorimon,
    nanomon: NpcNanomon,
    jijimon: NpcJijimon
  },

  appmon: {
    dressmon: NpcDressmon,
    savemon: NpcSavemon,
    logamon: NpcLogamon,
    mirrormon: NpcMirrormon,
    addmon: NpcAddmon,
    bookmon: NpcBookmon,
    oujamon: NpcOujamon,
    consulmon: NpcConsulmon,
    navimon: NpcNavimon
  }
}
