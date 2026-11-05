export type FloatingNavigationBarProps = {
  onOpenSettings: () => void
}

export type OpenPanel = {
  panel: 'navigation' | 'account'
  pathname: string
} | null
