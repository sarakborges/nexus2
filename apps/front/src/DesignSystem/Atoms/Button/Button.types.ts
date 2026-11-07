import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariation = 'primary' | 'secondary' | 'cancel' | 'transparent'

export type ButtonProps = {
  variation?: ButtonVariation
} & ButtonHTMLAttributes<HTMLButtonElement>
