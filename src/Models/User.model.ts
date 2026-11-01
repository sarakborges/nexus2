export type UserPassword = {
  hash: string
  salt: string
}

export type User = {
  id: string
  email: string
  password: UserPassword
  profiles: string[]
}

export type AuthenticatedUser = Pick<User, 'id' | 'email' | 'profiles'>
