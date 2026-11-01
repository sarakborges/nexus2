import type { ReactNode } from 'react'

import './Text.style.scss'

type TextElement = 'p' | 'h1' | 'h2' | 'span'

type TextProps = {
  as?: TextElement
  children: ReactNode
  className?: string
  id?: string
}

export function Text({
  as = 'span',
  children,
  className,
  id
}: TextProps) {
  const classNames = ['text', className].filter(Boolean).join(' ')

  if (as === 'p' && typeof children === 'string') {
    return (
      <>
        {children.split(/\n{2,}/).map((paragraph, index) => (
          <p className={classNames} id={index === 0 ? id : undefined} key={index}>
            {paragraph}
          </p>
        ))}
      </>
    )
  }

  const Component = as

  return (
    <Component className={classNames} id={id}>
      {children}
    </Component>
  )
}
