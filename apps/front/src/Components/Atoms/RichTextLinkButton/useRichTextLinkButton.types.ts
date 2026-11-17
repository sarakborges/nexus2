import type { MouseEvent } from 'react'
import type { RichTextLinkButtonProps } from './RichTextLinkButton.types'

export type UseRichTextLinkButtonOptions = Pick<
  RichTextLinkButtonProps,
  'promptLabel'
>

export type UseRichTextLinkButtonResult = {
  handleMouseDown: (event: MouseEvent<HTMLButtonElement>) => void
}
