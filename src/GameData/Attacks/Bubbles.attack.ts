import type { AttackType } from '@/Types/Attack.type'

export const BubblesAttack: AttackType = {
  id: 'bubbles',
  name: 'Bubbles',
  description: `Produces bubbles from its mouth to distract the target.`,
  condition: 'distracted'
}
