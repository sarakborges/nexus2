import { type FormEvent, useEffect, useState } from 'react'
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
  const duplicateName = duplicateProfile?.name ?? ''
  const duplicateUrl = duplicateProfile?.url ?? ''
  const duplicatePicture = duplicateProfile?.picture ?? ''
  const duplicateAbout = duplicateProfile?.about ?? ''
  const duplicateType = duplicateProfile?.type ?? 'social'
  const { t } = useTranslations()
  const { session, isAuthInitialized } = useAuthSessionState((state) => ({
    session: state.session,
    isAuthInitialized: state.isInitialized
  }))
  const user = session?.user
  const showToast = useToastStore((state) => state.showToast)
  const { name, setName, url, setUrl, picture, setPicture, about, setAbout } =
    useEntityDetailsDraft(duplicateProfile)
  const [type, setType] = useState<ProfileType>(duplicateType)
  const [errorMessage, setErrorMessage] = useState('')
  const createProfileMutation = useCreateProfileMutation()

  useEffect(() => {
    // Routes may reuse this page instance when duplicating from the account menu
    // while already on /create-profile. Re-seed the form for each navigation.
    setName(duplicateName)
    setUrl(duplicateUrl)
    setPicture(duplicatePicture)
    setAbout(duplicateAbout)
    setType(duplicateType)
    setErrorMessage('')
  }, [
    location.key,
    duplicateName,
    duplicateUrl,
    duplicatePicture,
    duplicateAbout,
    duplicateType,
    setName,
    setUrl,
    setPicture,
    setAbout
  ])

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
