import { useIsFetching, useIsMutating } from '@tanstack/react-query'

import { useState } from 'react'

import { useTranslations } from '@/Hooks/Language'
import {
  deleteUploadedFile,
  updateCommunityAvatar,
  updateProfileAvatar,
  uploadFile
} from '@/Services/Uploads'
import { useToastStore } from '@/Stores/Toast.store'

type UseAvatarUploadOptions = {
  purpose: 'profile-avatar' | 'community-avatar'
  onChange: (value: string) => void
  targetId?: string
  actorProfileId?: string
  errorLabel: string
}

export function useAvatarUpload({
  purpose,
  onChange,
  targetId,
  actorProfileId,
  errorLabel
}: UseAvatarUploadOptions) {
  const { t } = useTranslations()
  const showToast = useToastStore((state) => state.showToast)
  const isFetching = useIsFetching() > 0
  const isMutating = useIsMutating() > 0
  const isRequestPending = isFetching || isMutating
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState('')
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null)

  const handleFileChange = async (file: File) => {
    setError('')
    setIsUploading(true)

    try {
      const uploaded = await uploadFile(file, purpose, targetId, actorProfileId)
      if (targetId) {
        const result =
          purpose === 'profile-avatar'
            ? await updateProfileAvatar(targetId, uploaded.id)
            : await updateCommunityAvatar(
                targetId,
                actorProfileId!,
                uploaded.id
              )
        setPendingUploadId(null)
        onChange(result.picture)
      } else {
        if (pendingUploadId) await deleteUploadedFile(pendingUploadId)
        setPendingUploadId(uploaded.id)
        onChange(uploaded.url)
      }
      showToast(t('TOAST_AVATAR_UPDATED'))
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
        const result =
          purpose === 'profile-avatar'
            ? await updateProfileAvatar(targetId, null)
            : await updateCommunityAvatar(targetId, actorProfileId!, null)
        onChange(result.picture)
      } else {
        if (pendingUploadId) await deleteUploadedFile(pendingUploadId)
        setPendingUploadId(null)
        onChange('')
      }
      showToast(t('TOAST_AVATAR_REMOVED'))
    } catch {
      setError(errorLabel)
      showToast(t('TOAST_ACTION_FAILED'), 'error')
    } finally {
      setIsRemoving(false)
    }
  }

  return {
    busy: isUploading || isRemoving || isRequestPending,
    error,
    handleFileChange,
    handleRemove
  }
}
