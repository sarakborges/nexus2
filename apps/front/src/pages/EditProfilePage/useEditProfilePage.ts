import type { Profile, ProfileEditPageData } from '@nexus/common'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { type FormEvent, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'

import { ROUTES } from '@/Constants/routes'
import { useUpdateProfileMutation } from '@/Hooks/Profile'
import { useEntityFormDraft } from '@/Hooks/Forms'
import { useTranslations } from '@/Hooks/Language'
import { uploadEditorImage } from '@/Services/Uploads'
import { getApiErrorCode } from '@/Services/Http/api'
import { getProfileEditPage } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import type { UseEditProfilePageResult } from './useEditProfilePage.types'

export function useEditProfilePage(): UseEditProfilePageResult {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAuthStore((state) => state.session)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const viewerUserId = session?.user.id ?? null
  const currentProfileId = session?.user.currentProfile ?? null
  const showToast = useToastStore((state) => state.showToast)
  const requestedUrl = normalizeEntityUrl(url)

  const profileEditPageQuery = useQuery({
    queryKey: queryKeys.profileEditPage(
      requestedUrl,
      viewerUserId,
      currentProfileId
    ),
    queryFn: () => getProfileEditPage(requestedUrl),
    enabled: Boolean(requestedUrl && isAuthInitialized),
    staleTime: 30 * 1000
  })
  const profile = profileEditPageQuery.data?.profile
  const currentProfileType =
    profileEditPageQuery.data?.currentProfileType ?? null
  const typeCompatibility = {
    isChecking: Boolean(currentProfileId && profileEditPageQuery.isLoading),
    isCompatible:
      !currentProfileId ||
      (profileEditPageQuery.isSuccess &&
        currentProfileType === (profile?.type ?? 'social'))
  }
  const initialForm = useMemo(
    () =>
      profile
        ? { name: profile.name, url: profile.url, about: profile.about }
        : null,
    [profile]
  )
  const { form, updateForm } = useEntityFormDraft(
    profile?.id ?? null,
    initialForm
  )
  const [errorMessage, setErrorMessage] = useState('')
  const updateMutation = useUpdateProfileMutation()

  const cancelEdit = () => {
    if (profile) navigate(ROUTES.profile + '/' + profile.url)
  }

  const updateProfilePicture = (picture: string) => {
    if (!profile) return
    queryClient.setQueryData<Profile>(
      queryKeys.profiles.byUrl(profile.url),
      (current) => (current ? { ...current, picture } : current)
    )
    queryClient.setQueryData<ProfileEditPageData>(
      queryKeys.profileEditPage(requestedUrl, viewerUserId, currentProfileId),
      (current) =>
        current?.profile
          ? { ...current, profile: { ...current.profile, picture } }
          : current
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    if (!profile || !form) return

    try {
      const updated = await updateMutation.mutateAsync({
        profileId: profile.id,
        input: {
          name: form.name,
          url: form.url || undefined,
          picture: profile.picture,
          about: form.about
        }
      })
      showToast(t('TOAST_PROFILE_UPDATED'))
      navigate(ROUTES.profile + '/' + updated.url, { replace: true })
    } catch (error) {
      const code = getApiErrorCode(error)
      const key =
        code === 'PROFILE_URL_ALREADY_IN_USE'
          ? 'PROFILE_ERROR_URL_TAKEN'
          : code === 'INVALID_PROFILE'
            ? 'PROFILE_ERROR_INVALID'
            : 'PROFILE_UPDATE_ERROR'
      setErrorMessage(t(key))
      showToast(t(key), 'error')
    }
  }

  return {
    requestedUrl,
    session,
    isAuthInitialized,
    profileEditPageQuery,
    profile,
    typeCompatibility,
    form,
    errorMessage,
    isSubmitting: updateMutation.isPending,
    updateForm,
    updateProfilePicture,
    cancelEdit,
    handleSubmit,
    uploadEditorImage
  }
}
