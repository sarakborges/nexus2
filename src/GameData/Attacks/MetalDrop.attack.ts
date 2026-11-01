import type { AttackType } from '@/Types/Attack.type'

export const MetalDropAttack: AttackType = {
  id: 'metalDrop',
  name: 'Metal Drop',
  description: `Spits a small metal sphere at the target, leaving them stuck in place.`,
  condition: 'stunned'
}
