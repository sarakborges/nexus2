import type { MouseEvent } from 'react'
import type { RichTextEditorProps } from './RichTextEditor.types'

export type UseRichTextEditorOptions = Pick<
  RichTextEditorProps,
  'onChange' | 'maxTextLength'
>

export type UseRichTextEditorController = {
  isRequestPending: boolean
  isImageUploading: boolean
  isHtmlMode: boolean
  setImageUploading: (isUploading: boolean) => void
  openHtmlMode: () => void
  closeHtmlMode: () => void
  handleChange: (value: string) => void
  handleHtmlModeMouseDown: (event: MouseEvent<HTMLButtonElement>) => void
}
