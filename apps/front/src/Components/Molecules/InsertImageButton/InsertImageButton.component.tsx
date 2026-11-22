import type { InsertImageButtonProps } from './InsertImageButton.types'
import { useInsertImageButton } from './useInsertImageButton'
import { FiImage } from 'react-icons/fi'

import { Button, Input } from '@/DesignSystem'

export function InsertImageButton({
  label,
  uploadErrorLabel,
  onUploadImage,
  onUploadingChange
}: InsertImageButtonProps) {
  const {
    inputRef,
    error,
    isDisabled,
    handleMouseDown,
    handleFileChange
  } = useInsertImageButton({
    uploadErrorLabel,
    onUploadImage,
    onUploadingChange
  })

  return (
    <>
      <Button
        variation="transparent"
        className="rsw-btn rich-text-editor__toolbar-button"
        type="button"
        title={label}
        aria-label={label}
        disabled={isDisabled}
        onMouseDown={handleMouseDown}
      >
        <FiImage aria-hidden="true" />
      </Button>
      <Input
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
