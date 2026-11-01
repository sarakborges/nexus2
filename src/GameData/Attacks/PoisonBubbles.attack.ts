import type { AttackType } from '@/Types/Attack.type'

export const PoisonBubblesAttack: AttackType = {
  id: 'poisonBubbles',
  name: 'Poison Bubbles',
  description: `Produces poisonous bubbles from its mouth to hinder the target.`,
  condition: 'poisoned'
}
