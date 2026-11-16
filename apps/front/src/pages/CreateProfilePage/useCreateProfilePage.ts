import { type FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import type { Profile } from '@nexus/common'
import type { ProfileType } from '@/Models/Profile.model'
import { ROUTES } from '@/Constants/routes'
import { useEntityDetailsDraft } from '@/Hooks/Forms'
import { useCreateProfileMutation } from '@/Hooks/Profile'
import { useTranslations } from '@/Hooks/Language'
import { getApiErrorCode } from '@/Services/Http/api'
import { uploadEditorImage } from '@/Services/Uploads'
import { useAuthSessionState } from '@/Hooks/Auth'
import { useToastStore } from '@/Stores/Toast.store'
import type { UseCreateProfilePageResult } from './useCreateProfilePage.types'

export function useCreateProfilePage(): UseCreateProfilePageResult {
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as {
    duplicateProfile?: Pick<Profile, 'name' | 'url' | 'picture' | 'about' | 'type'>
    duplicateMediaOmitted?: boolean
  } | null
  const duplicateProfile = locationState?.duplicateProfile
  const duplicateMediaOmitted = Boolean(locationState?.duplicateMediaOmitted)
  const { t } = useTranslations()
  const { session, isAuthInitialized } = useAuthSessionState((state) => ({
    session: state.session,
    isAuthInitialized: state.isInitialized
  }))
  const user = session?.user
  const showToast = useToastStore((state) => state.showToast)
  const { name, setName, url, setUrl, picture, setPicture, about, setAbout } =
    useEntityDetailsDraft(duplicateProfile)
  const [type, setType] = useState<ProfileType>(duplicateProfile?.type ?? 'social')
  const [errorMessage, setErrorMessage] = useState('')
  const createProfileMutation = useCreateProfileMutation()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')

    if (!isAuthInitialized) return
    if (!user) {
      navigate(ROUTES.signIn, { replace: true })
      return
    }

    try {
      await createProfileMutation.mutateAsync({
        name,
        url: url || undefined,
        picture,
        about,
        type
      })
      showToast(t('TOAST_PROFILE_CREATED'))
      navigate(ROUTES.home, { replace: true })
    } catch (error) {
      const code = getApiErrorCode(error)
      const key =
        code === 'PROFILE_URL_ALREADY_IN_USE'
          ? 'PROFILE_ERROR_URL_TAKEN'
          : code === 'INVALID_PROFILE'
            ? 'PROFILE_ERROR_INVALID'
            : code === 'PROFILE_CREATION_SESSION_MISSING' ||
                code === 'PROFILE_CREATION_SESSION_INCONSISTENT'
              ? 'PROFILE_ERROR_SESSION'
              : 'PROFILE_ERROR_GENERIC'
      setErrorMessage(t(key))
      showToast(t(key), 'error')
    }
  }

  return {
    isAuthInitialized,
    duplicateMediaOmitted,
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
