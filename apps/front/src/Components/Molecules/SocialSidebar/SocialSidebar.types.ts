import type { ReactNode } from 'react'

export type SocialSidebarNavigationItem = {
  href: string
  label: string
  isActive: boolean
}

export type SocialSidebarProps = {
  href: string
  imageLabel: string
  name: string
  picture: string
  pictureVariant: 'profile' | 'community'
  metadata?: string
  relationshipActions?: ReactNode
  navigationLabel: string
  navigationItems: SocialSidebarNavigationItem[]
}
