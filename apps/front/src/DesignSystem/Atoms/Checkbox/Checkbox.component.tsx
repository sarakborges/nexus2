import type { CheckboxProps } from './Checkbox.types'

import './Checkbox.style.scss'

export function Checkbox({ className, ...props }: CheckboxProps) {
  const classNames = ['checkbox', className].filter(Boolean).join(' ')

  return <input className={classNames} type="checkbox" {...props} />
}
