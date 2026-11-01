import type { AttackType } from '@/Types/Attack.type'

export const AcidBubblesAttack: AttackType = {
  id: 'acidBubbles',
  name: 'Acid Bubbles',
  description: `Produces slightly acidic bubbles from its mouth to irritate the target.`,
  condition: 'irritated'
}
