import type { MouseEvent, SyntheticEvent } from 'react'
import type { ModalProps } from './Modal.types'

export type UseModalDialogOptions = Pick<
  ModalProps,
  'open' | 'onClose' | 'closeOnBackdrop'
>

export type UseModalDialogResult = {
  dialogRef: { current: HTMLDialogElement | null }
  titleId: string
  handleCancel: (event: SyntheticEvent<HTMLDialogElement>) => void
  handleBackdropClick: (event: MouseEvent<HTMLDialogElement>) => void
}
