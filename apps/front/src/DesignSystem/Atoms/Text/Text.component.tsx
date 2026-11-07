import type { TextElement, TextProps } from './Text.types'

import './Text.style.scss'

export function Text<T extends TextElement = 'span'>({
  as,
  className,
  ...props
}: TextProps<T>) {
  const Component = as ?? 'span'
  const classNames = ['text', className].filter(Boolean).join(' ')

  return <Component className={classNames} {...props} />
}
