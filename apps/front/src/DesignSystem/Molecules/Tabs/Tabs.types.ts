export type TabOption = {
  value: string
  label: string
  disabled?: boolean
}

export type TabsProps = {
  options: TabOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  className?: string
}
