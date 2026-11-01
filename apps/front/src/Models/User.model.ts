export type UserPassword = {
  hash: string
  salt: string
}

export type User = {
  id: string
  email: string
  password: UserPassword
  profiles: string[]
  currentProfile: string | null
}

export type AuthenticatedUser = Pick<
  User,
  'id' | 'email' | 'profiles' | 'currentProfile'
>
