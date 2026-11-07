import type { Profile } from '@nexus/common'

export type MemberTab = 'all' | 'staff' | 'banned'
export type Member = Profile & { role: string }
