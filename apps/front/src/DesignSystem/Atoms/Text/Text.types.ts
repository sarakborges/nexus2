import type { ComponentPropsWithoutRef } from 'react'

export type TextElement = 'p' | 'span' | 'h1' | 'h2'

export type TextProps<T extends TextElement = 'span'> = {
  as?: T
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>
