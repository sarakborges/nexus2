export type { AuthenticatedUser } from '@nexus/common'
export type User = AuthenticatedUser & { password?: { hash: string; salt: string } }
