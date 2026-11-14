import type { SelectProps } from './Select.types'

import './Select.style.scss'

export function Select({ className, ...props }: SelectProps) {
  const classNames = ['select', className].filter(Boolean).join(' ')

  return <select className={classNames} {...props} />
}
