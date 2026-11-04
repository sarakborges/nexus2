import { useAvatarUpload } from './useAvatarUpload'
import { FiImage } from 'react-icons/fi'

import { type ChangeEvent, useRef } from 'react'

import './AvatarUploadField.style.scss'

type AvatarUploadFieldProps = {
  label: string
  value: string
  fallbackName: string
  purpose: 'profile-avatar' | 'community-avatar'
  onChange: (value: string) => void
  targetId?: string
  actorProfileId?: string
  selectLabel: string
  changeLabel: string
  removeLabel: string
  uploadingLabel: string
  errorLabel: string
  emptyLabel: string
}

export function AvatarUploadField({
  label,
  value,
  fallbackName,
  purpose,
  onChange,
  targetId,
  actorProfileId,
  selectLabel,
  changeLabel,
  removeLabel,
  uploadingLabel,
  errorLabel,
  emptyLabel
}: AvatarUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { busy, error, handleFileChange, handleRemove } = useAvatarUpload({
    purpose,
    onChange,
    targetId,
    actorProfileId,
    errorLabel
  })

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file) void handleFileChange(file)
  }

  return (
    <div className="avatar-upload-field">
      <span className="avatar-upload-field__label">{label}</span>
      <div className="avatar-upload-field__preview">
        {value ? (
          <img src={value} alt="" />
        ) : (
          <span
            className="avatar-upload-field__fallback"
            aria-hidden="true"
            title={emptyLabel}
          >
            {fallbackName.trim().charAt(0).toUpperCase() || <FiImage />}
          </span>
        )}
      </div>
      <div className="avatar-upload-field__actions">
        <button
          className="avatar-upload-field__button"
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? uploadingLabel : value ? changeLabel : selectLabel}
        </button>
        {value && (
          <button
            className="avatar-upload-field__remove"
            type="button"
            disabled={busy}
            onClick={() => void handleRemove()}
          >
            {removeLabel}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        className="avatar-upload-field__input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        aria-label={label}
        onChange={onInputChange}
      />
      {error && (
        <p className="avatar-upload-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
