import { useIsFetching, useIsMutating } from '@tanstack/react-query'

import type {
  UseAvatarUploadController,
  UseAvatarUploadOptions
} from './useAvatarUpload.types'

import { useState } from 'react'

import { useTranslations } from '@/Hooks/Language'
import {
  deleteUploadedFile,
  updateCommunityAvatar,
  updateProfileAvatar,
  uploadFile
} from '@/Services/Uploads'
import { useToastStore } from '@/Stores/Toast.store'

export function useAvatarUpload({
  purpose,
  onChange,
  targetId,
  actorProfileId,
  errorLabel
}: UseAvatarUploadOptions): UseAvatarUploadController {
  const { t } = useTranslations()
  const showToast = useToastStore((state) => state.showToast)
  const isFetching = useIsFetching() > 0
  const isMutating = useIsMutating() > 0
  const isRequestPending = isFetching || isMutating
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState('')
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null)

  const updateAvatar = (avatarTargetId: string, uploadId: string | null) => {
    if (purpose === 'profile-avatar') {
      return updateProfileAvatar(avatarTargetId, uploadId)
    }

    if (!actorProfileId) {
      throw new Error('COMMUNITY_ACTOR_PROFILE_REQUIRED')
    }

    return updateCommunityAvatar(avatarTargetId, actorProfileId, uploadId)
  }

  const handleFileChange = async (file: File) => {
    setError('')
    setIsUploading(true)

    try {
      const uploaded = await uploadFile(file, purpose, targetId, actorProfileId)
      if (targetId) {
        const result = await updateAvatar(targetId, uploaded.id)
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
        const result = await updateAvatar(targetId, null)
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
