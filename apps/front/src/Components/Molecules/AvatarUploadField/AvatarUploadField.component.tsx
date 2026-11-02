import { useRef, useState, type ChangeEvent } from 'react'
import {
  deleteUploadedFile,
  uploadFile,
  updateCommunityAvatar,
  updateProfileAvatar,
} from '@/Services/Uploads'
import './AvatarUploadField.style.scss'

type AvatarUploadFieldProps = {
  label: string
  value: string
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
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState('')
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    setError('')
    setIsUploading(true)
    try {
      const uploaded = await uploadFile(file, purpose, targetId, actorProfileId)
      if (targetId) {
        const result = purpose === 'profile-avatar'
          ? await updateProfileAvatar(targetId, uploaded.id)
          : await updateCommunityAvatar(targetId, actorProfileId!, uploaded.id)
        setPendingUploadId(null)
        onChange(result.picture)
      } else {
        if (pendingUploadId) await deleteUploadedFile(pendingUploadId)
        setPendingUploadId(uploaded.id)
        onChange(uploaded.url)
      }
    } catch {
      setError(errorLabel)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = async () => {
    setError('')
    setIsRemoving(true)
    try {
      if (targetId) {
        const result = purpose === 'profile-avatar'
          ? await updateProfileAvatar(targetId, null)
          : await updateCommunityAvatar(targetId, actorProfileId!, null)
        onChange(result.picture)
      } else {
        if (pendingUploadId) await deleteUploadedFile(pendingUploadId)
        setPendingUploadId(null)
        onChange('')
      }
    } catch {
      setError(errorLabel)
    } finally {
      setIsRemoving(false)
    }
  }

  const busy = isUploading || isRemoving

  return (
    <div className="avatar-upload-field">
      <span className="avatar-upload-field__label">{label}</span>
      <div className="avatar-upload-field__preview">
        {value
          ? <img src={value} alt="" />
          : <span>{emptyLabel}</span>}
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
        onChange={event => void handleFileChange(event)}
      />
      {error && <p className="avatar-upload-field__error" role="alert">{error}</p>}
    </div>
  )
}
