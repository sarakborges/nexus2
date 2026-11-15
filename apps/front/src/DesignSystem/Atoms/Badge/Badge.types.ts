import type { HTMLAttributes } from 'react'

export type BadgeTone = 'neutral' | 'warning'

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone
}
