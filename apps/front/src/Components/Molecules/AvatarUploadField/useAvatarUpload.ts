import type {
  UseAvatarUploadController,
  UseAvatarUploadOptions
} from './useAvatarUpload.types'

import { useState } from 'react'
import type { ChangeEvent } from 'react'

import { useTranslations } from '@/Hooks/Language'
import { useAvatarMutation } from '@/Hooks/Uploads'
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
  const avatarMutation = useAvatarMutation()
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState('')
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null)

  const handleFileChange = async (file: File) => {
    setError('')
    setIsUploading(true)

    try {
      const result = await avatarMutation.mutateAsync({
        action: 'upload',
        file,
        purpose,
        targetId,
        actorProfileId,
        pendingUploadId
      })
      setPendingUploadId(result.pendingUploadId)
      onChange(result.picture)
      showToast(t('TOAST_AVATAR_UPDATED'))
    } catch {
      setError(errorLabel)
      showToast(t('TOAST_ACTION_FAILED'), 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file) void handleFileChange(file)
  }

  const handleRemove = async () => {
    setError('')
    setIsRemoving(true)

    try {
      const result = await avatarMutation.mutateAsync({
        action: 'remove',
        purpose,
        targetId,
        actorProfileId,
        pendingUploadId
      })
      setPendingUploadId(result.pendingUploadId)
      onChange(result.picture)
      showToast(t('TOAST_AVATAR_REMOVED'))
    } catch {
      setError(errorLabel)
      showToast(t('TOAST_ACTION_FAILED'), 'error')
    } finally {
      setIsRemoving(false)
    }
  }

  return {
    busy: isUploading || isRemoving || avatarMutation.isPending,
    error,
    handleFileChange,
    handleInputChange,
    handleRemove
  }
}
