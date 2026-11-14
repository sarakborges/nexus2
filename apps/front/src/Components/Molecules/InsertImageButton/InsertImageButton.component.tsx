import './InsertImageButton.style.scss'
import type { InsertImageButtonProps } from './InsertImageButton.types'
import { useInsertImageButton } from './useInsertImageButton'
import { FiImage } from 'react-icons/fi'

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
      <button
        className="rsw-btn rich-text-editor__toolbar-button"
        type="button"
        title={label}
        aria-label={label}
        disabled={isDisabled}
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
