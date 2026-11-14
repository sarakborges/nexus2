import type { ReactNode } from 'react'
import type { Profile } from '@nexus/common'

export type CommunityForumEntryProps = {
  author: Profile | undefined
  content: string
  createdAt: number
  className: string
  unknownAuthorLabel: string
  children?: ReactNode
}
