import type { CommunityPrivacy } from '@nexus/common'

export type CommunityForm = {
  name: string
  url: string
  about: string
  privacy: CommunityPrivacy
}
