import type { ComponentPropsWithoutRef } from 'react'

import './Text.style.scss'

type TextElement = 'p' | 'span' | 'h1' | 'h2'

type TextProps<T extends TextElement = 'span'> = {
  as?: T
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>

export function Text<T extends TextElement = 'span'>({
  as,
  className,
  ...props
}: TextProps<T>) {
  const Component = as ?? 'span'
  const classNames = ['text', className].filter(Boolean).join(' ')

  return <Component className={classNames} {...props} />
}
