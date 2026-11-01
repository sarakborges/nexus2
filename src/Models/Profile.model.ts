export type Profile = {
  id: string
  name: string
  url: string
  picture: string
  about: string
}

export type CreateProfileInput = Omit<Profile, 'id'>
