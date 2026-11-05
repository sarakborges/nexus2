export type UseFloatingNavigationBarOptions = {
  onOpenSettings: () => void
}

export type OpenPanel = {
  panel: 'navigation' | 'account'
  pathname: string
} | null
