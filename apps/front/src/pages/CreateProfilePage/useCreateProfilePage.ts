import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { uploadEditorImage } from '@/Services/Uploads'
import type { ProfileType } from '@/Models/Profile.model'
import { getApiErrorCode } from '@/Services/Http/api'
import { createUserProfile } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'

export function useCreateProfilePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslations()
  const session = useAuthStore((state) => state.session)
  const user = session?.user
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const showToast = useToastStore((state) => state.showToast)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [picture, setPicture] = useState('')
  const [about, setAbout] = useState('')
  const [type, setType] = useState<ProfileType>('social')
  const [errorMessage, setErrorMessage] = useState('')

  const createProfileMutation = useMutation({
    mutationFn: async () => {
      const result = await createUserProfile({
        name,
        url: url || undefined,
        picture,
        about,
        type
      })
      const currentSession = useAuthStore.getState().session
      if (
        !currentSession ||
        result.user.id !== currentSession.user.id ||
        !result.user.profiles.includes(result.profile.id) ||
        result.user.currentProfile !== result.profile.id
      ) {
        throw new Error('PROFILE_CREATION_SESSION_INCONSISTENT')
      }
      useAuthStore
        .getState()
        .setSession({
          user: result.user,
          authenticatedAt: currentSession.authenticatedAt
        })
      return result
    },
    onSuccess: async (result) => {
      queryClient.setQueryData(
        queryKeys.profiles.byUrl(result.profile.url),
        result.profile
      )
      queryClient.setQueryData(
        queryKeys.auth.session,
        useAuthStore.getState().session
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['auth'] }),
        queryClient.invalidateQueries({ queryKey: ['activity'] })
      ])
      showToast(t('TOAST_PROFILE_CREATED'))
    }
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    if (!isAuthInitialized) return
    if (!user) {
      navigate(ROUTES.signIn, { replace: true })
      return
    }
    try {
      await createProfileMutation.mutateAsync()
      navigate(ROUTES.home, { replace: true })
    } catch (error) {
      const code = getApiErrorCode(error)
      const key =
        code === 'PROFILE_URL_ALREADY_IN_USE'
          ? 'PROFILE_ERROR_URL_TAKEN'
          : code === 'INVALID_PROFILE'
            ? 'PROFILE_ERROR_INVALID'
            : code === 'PROFILE_CREATION_SESSION_MISSING'
              ? 'PROFILE_ERROR_SESSION'
              : code === 'PROFILE_CREATION_SESSION_INCONSISTENT'
                ? 'PROFILE_ERROR_SESSION'
                : 'PROFILE_ERROR_GENERIC'
      setErrorMessage(t(key))
      showToast(t(key), 'error')
    }
  }

  return {
    isAuthInitialized,
    name,
    setName,
    url,
    setUrl,
    picture,
    setPicture,
    about,
    setAbout,
    type,
    setType,
    errorMessage,
    isSubmitting: createProfileMutation.isPending,
    handleSubmit,
    handleCancel: () =>
      navigate(user?.profiles.length ? ROUTES.home : ROUTES.gettingStarted),
    uploadEditorImage
  }
}
