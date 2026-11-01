export type ProfileType = 'social' | 'rp' | 'business'

export type Profile = {
  id: string
  name: string
  url: string
  picture: string
  about: string
  type: ProfileType
}

export type CreateProfileInput = Omit<Profile, 'id'>
