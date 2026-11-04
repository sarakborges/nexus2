import { useRef, useState, type ChangeEvent } from 'react'
import { FiImage } from 'react-icons/fi'
import { useToastStore } from '@/Stores/Toast.store'
import { useTranslations } from '@/Hooks/Language'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import {
  deleteUploadedFile,
  uploadFile,
  updateCommunityAvatar,
  updateProfileAvatar
} from '@/Services/Uploads'
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
  const { t } = useTranslations()
  const inputRef = useRef<HTMLInputElement>(null)
  const showToast = useToastStore(state => state.showToast)
  const isFetching = useIsFetching() > 0
  const isMutating = useIsMutating() > 0
  const isRequestPending = isFetching || isMutating
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
        showToast(t('TOAST_AVATAR_UPDATED'))
      } else {
        if (pendingUploadId) await deleteUploadedFile(pendingUploadId)
        setPendingUploadId(uploaded.id)
        onChange(uploaded.url)
        showToast(t('TOAST_AVATAR_UPDATED'))
      }
    } catch {
      setError(errorLabel)
      showToast(t('TOAST_ACTION_FAILED'), 'error')
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
        showToast(t('TOAST_AVATAR_REMOVED'))
      } else {
        if (pendingUploadId) await deleteUploadedFile(pendingUploadId)
        setPendingUploadId(null)
        onChange('')
        showToast(t('TOAST_AVATAR_REMOVED'))
      }
    } catch {
      setError(errorLabel)
      showToast(t('TOAST_ACTION_FAILED'), 'error')
    } finally {
      setIsRemoving(false)
    }
  }

  const busy = isUploading || isRemoving || isRequestPending

  return (
    <div className="avatar-upload-field">
      <span className="avatar-upload-field__label">{label}</span>
      <div className="avatar-upload-field__preview">
        {value
          ? <img src={value} alt="" />
          : <span className="avatar-upload-field__fallback" aria-hidden="true" title={emptyLabel}>
              {fallbackName.trim().charAt(0).toUpperCase() || <FiImage />}
            </span>}
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
