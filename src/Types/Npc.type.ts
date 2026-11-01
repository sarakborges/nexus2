import type { CharacterType } from '@/Types/Character.type'

export type NpcType = CharacterType & {
  description?: string
  category?: 'appmon' | 'digimon' | 'general'
}
