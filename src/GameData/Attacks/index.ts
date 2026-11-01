import { AcidBubblesAttack } from './AcidBubbles.attack'
import { BubblesAttack } from './Bubbles.attack'
import { MetalDropAttack } from './MetalDrop.attack'
import { PoisonBubblesAttack } from './PoisonBubbles.attack'
import { TackleAttack } from './Tackle.attack'

import type { AttackType } from '@/Types/Attack.type'

export const AllAttacks: Record<string, AttackType> = {
  tackle: TackleAttack,
  bubbles: BubblesAttack,
  acidBubbles: AcidBubblesAttack,
  poisonBubbles: PoisonBubblesAttack,
  metalDrop: MetalDropAttack
}
