import type { ProfileType } from './Profile.model'

export type Community = {
  id: string
  name: string
  url: string
  picture: string
  about: string
  type: ProfileType
}

export type CreateCommunityInput = Omit<Community, 'id'>
