import type { InsertImageButtonProps } from './InsertImageButton.types'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { FiImage } from 'react-icons/fi'
import { useEditorState } from 'react-simple-wysiwyg'

import { type ChangeEvent, type MouseEvent, useRef, useState } from 'react'

export function InsertImageButton({
  label,
  uploadErrorLabel,
  onUploadImage,
  onUploadingChange
}: InsertImageButtonProps) {
  const editorState = useEditorState()
  const inputRef = useRef<HTMLInputElement>(null)
  const selectionRef = useRef<Range | null>(null)
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const isFetching = useIsFetching() > 0
  const isMutating = useIsMutating() > 0
  const isRequestPending = isFetching || isMutating

  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
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

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
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

  return (
    <>
      <button
        className="rsw-btn rich-text-editor__toolbar-button"
        type="button"
        title={label}
        aria-label={label}
        disabled={isRequestPending || isUploading}
        onMouseDown={handleMouseDown}
      >
        <FiImage aria-hidden="true" />
      </button>
      <input
        ref={inputRef}
        className="rich-text-editor__file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        aria-label={label}
        onChange={(event) => void handleFileChange(event)}
      />
      {error && (
        <span className="rich-text-editor__upload-error" role="alert">
          {error}
        </span>
      )}
    </>
  )
}
