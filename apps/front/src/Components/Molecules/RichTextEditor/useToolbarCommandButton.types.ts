import type { MouseEvent } from 'react'
import type { ToolbarCommandButtonProps } from './ToolbarCommandButton.types'

export type UseToolbarCommandButtonOptions = Pick<
  ToolbarCommandButtonProps,
  'command'
>

export type UseToolbarCommandButtonResult = {
  handleMouseDown: (event: MouseEvent<HTMLButtonElement>) => void
}
