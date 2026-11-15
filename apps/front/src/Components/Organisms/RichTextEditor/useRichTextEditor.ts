import { useState } from 'react'

import type {
  UseRichTextEditorController,
  UseRichTextEditorOptions
} from './useRichTextEditor.types'

export function useRichTextEditor({ onChange }: UseRichTextEditorOptions): UseRichTextEditorController {
  const [isImageUploading, setIsImageUploading] = useState(false)
  const [isHtmlMode, setIsHtmlMode] = useState(false)

  const handleHtmlModeMouseDown: UseRichTextEditorController['handleHtmlModeMouseDown'] = (event) => event.preventDefault()

  const handleChange = (nextValue: string) => onChange(nextValue)

  return {
    isImageUploading,
    isHtmlMode,
    setImageUploading: setIsImageUploading,
    openHtmlMode: () => setIsHtmlMode(true),
    closeHtmlMode: () => setIsHtmlMode(false),
    handleChange,
    handleHtmlModeMouseDown
  }
}
