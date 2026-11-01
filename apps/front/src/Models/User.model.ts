import type { AuthenticatedUser } from '@nexus/common'

export type { AuthenticatedUser } from '@nexus/common'
export type UserPassword = { hash: string; salt: string }
export type User = AuthenticatedUser & { password?: UserPassword }
