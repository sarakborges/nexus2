import type { ChangeEvent, MouseEvent } from 'react'
import type { InsertImageButtonProps } from './InsertImageButton.types'

export type UseInsertImageButtonOptions = Pick<
  InsertImageButtonProps,
  'uploadErrorLabel' | 'onUploadImage' | 'onUploadingChange'
>

export type UseInsertImageButtonController = {
  inputRef: { current: HTMLInputElement | null }
  error: string
  isDisabled: boolean
  handleMouseDown: (event: MouseEvent<HTMLButtonElement>) => void
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
}
