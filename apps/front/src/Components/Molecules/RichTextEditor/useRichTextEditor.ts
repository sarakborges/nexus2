import { useIsFetching, useIsMutating } from '@tanstack/react-query'

import { useState } from 'react'
import type { MouseEvent } from 'react'

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
  const isFetching = useIsFetching() > 0
  const isMutating = useIsMutating() > 0
  const isRequestPending = isFetching || isMutating

  const handleHtmlModeMouseDown: UseRichTextEditorController['handleHtmlModeMouseDown'] = (event) => event.preventDefault()

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
    handleChange,
    handleHtmlModeMouseDown
  }
}
