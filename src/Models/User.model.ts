export type UserPassword = {
  hash: string
  salt: string
}

export type User = {
  id: string
  email: string
  password: UserPassword
}

export type AuthenticatedUser = Pick<User, 'id' | 'email'>
