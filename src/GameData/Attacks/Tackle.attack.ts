import type { AttackType } from '@/Types/Attack.type'

export const TackleAttack: AttackType = {
  id: 'tackle',
  name: 'Tackle',
  description: `Agressively leaps towards it's target, shaking them on impact.`,
  condition: 'shaken'
}
