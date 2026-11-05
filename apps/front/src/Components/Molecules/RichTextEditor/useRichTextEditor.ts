import { useIsFetching, useIsMutating } from '@tanstack/react-query'

import { useState } from 'react'

import { getRichTextPlainText } from './richText.utils'
import type {
  UseRichTextEditorController,
  UseRichTextEditorOptions
} from './useRichTextEditor.types'

export function useRichTextEditor({
  onChange,
  maxTextLength
}: UseRichTextEditorOptions): UseRichTextEditorController {
  const [isImageUploading, setIsImageUploading] = useState(false)
  const [isHtmlMode, setIsHtmlMode] = useState(false)
  const isRequestPending = useIsFetching() > 0 || useIsMutating() > 0

  const handleChange = (nextValue: string) => {
    if (
      maxTextLength !== undefined &&
      getRichTextPlainText(nextValue).length > maxTextLength
    ) return

    onChange(nextValue)
  }

  return {
    isRequestPending,
    isImageUploading,
    isHtmlMode,
    setImageUploading: setIsImageUploading,
    openHtmlMode: () => setIsHtmlMode(true),
    closeHtmlMode: () => setIsHtmlMode(false),
    handleChange
  }
}
