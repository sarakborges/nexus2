import type { MouseEvent } from 'react'

export type RichTextToolbarProps = {
  imageButtonLabel: string
  imageUploadErrorLabel: string
  onUploadImage: (file: File) => Promise<string>
  onUploadingChange: (isUploading: boolean) => void
  onOpenHtmlMode: () => void
  onHtmlModeMouseDown: (event: MouseEvent<HTMLButtonElement>) => void
}
