import type { ReactNode } from 'react'

export type EntityDirectoryGridEntry = {
  id: string
  name: string
  picture: string
  href: string
  secondaryText: string
  actions?: ReactNode
}

export type EntityDirectoryGridProps = {
  entries: EntityDirectoryGridEntry[]
}
