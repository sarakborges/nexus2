import { Button } from '@/DesignSystem/Atoms/Button'
import './Tabs.style.scss'
export type TabOption = { value: string; label: string; disabled?: boolean }
export type TabsProps = { options: TabOption[]; value: string; onChange: (value: string) => void; ariaLabel: string; className?: string }
export function Tabs({ options, value, onChange, ariaLabel, className }: TabsProps) {
  return (
    <div className={['ds-tabs', className].filter(Boolean).join(' ')} role="tablist" aria-label={ariaLabel}>
      {options.map(option => {
        const selected = option.value === value
        return <Button key={option.value} type="button" variation={selected ? 'secondary' : 'transparent'} className="ds-tabs__tab" role="tab" aria-selected={selected} tabIndex={selected ? 0 : -1} disabled={option.disabled} onClick={() => onChange(option.value)}>{option.label}</Button>
      })}
    </div>
  )
}
