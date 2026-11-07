import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { useEditorState } from 'react-simple-wysiwyg'

import { useRef, useState } from 'react'

import type {
  UseInsertImageButtonController,
  UseInsertImageButtonOptions
} from './useInsertImageButton.types'

export function useInsertImageButton({
  uploadErrorLabel,
  onUploadImage,
  onUploadingChange
}: UseInsertImageButtonOptions): UseInsertImageButtonController {
  const editorState = useEditorState()
  const inputRef = useRef<HTMLInputElement>(null)
  const selectionRef = useRef<Range | null>(null)
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const isFetching = useIsFetching() > 0
  const isMutating = useIsMutating() > 0
  const isRequestPending = isFetching || isMutating

  const handleMouseDown: UseInsertImageButtonController['handleMouseDown'] = event => {
    event.preventDefault()
    if (isRequestPending || isUploading) return

    const selection = window.getSelection()
    selectionRef.current =
      selection && selection.rangeCount > 0
        ? selection.getRangeAt(0).cloneRange()
        : null

    editorState.$el?.focus()
    inputRef.current?.click()
  }

  const handleFileChange: UseInsertImageButtonController['handleFileChange'] = async event => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    setError('')
    setIsUploading(true)
    onUploadingChange(true)

    try {
      const imageUrl = await onUploadImage(file)
      editorState.$el?.focus()

      const selection = window.getSelection()
      if (selection && selectionRef.current) {
        selection.removeAllRanges()
        selection.addRange(selectionRef.current)
      }

      document.execCommand('insertImage', false, imageUrl)
      selectionRef.current = null
    } catch {
      setError(uploadErrorLabel)
    } finally {
      setIsUploading(false)
      onUploadingChange(false)
    }
  }

  return {
    inputRef,
    error,
    isDisabled: isRequestPending || isUploading,
    handleMouseDown,
    handleFileChange
  }
}
