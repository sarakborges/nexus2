import type { Profile } from '@nexus/common'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import type { ProfileForm } from './EditProfilePage.types'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { uploadEditorImage } from '@/Services/Uploads'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { getApiErrorCode } from '@/Services/Http/api'
import { getProfileByUrl, updateUserProfile } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'

export function useEditProfilePage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAuthStore((state) => state.session)
  const showToast = useToastStore((state) => state.showToast)
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''

  const profileQuery = useQuery({
    queryKey: queryKeys.profiles.byUrl(requestedUrl),
    queryFn: () => getProfileByUrl(requestedUrl),
    enabled: Boolean(requestedUrl)
  })
  const profile = profileQuery.data
  const typeCompatibility = useProfileTypeCompatibility(
    profile?.type ?? 'social'
  )
  const initializedProfileId = useRef<string | null>(null)
  const [form, setForm] = useState<ProfileForm | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!profile || initializedProfileId.current === profile.id) return
    initializedProfileId.current = profile.id
    setForm({ name: profile.name, url: profile.url, about: profile.about })
  }, [profile])

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!profile || !form) throw new Error('PROFILE_NOT_READY')
      return updateUserProfile(profile.id, {
        name: form.name,
        url: form.url || undefined,
        picture: profile.picture,
        about: form.about
      })
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.profiles.byUrl(updated.url), updated)
      await queryClient.invalidateQueries({ queryKey: ['profiles'] })
      showToast(t('TOAST_PROFILE_UPDATED'))
      navigate(ROUTES.profile + '/' + updated.url, { replace: true })
    }
  })

  const updateForm = (patch: Partial<ProfileForm>) => {
    setForm((current) => current ? { ...current, ...patch } : current)
  }

  const cancelEdit = () => {
    if (profile) navigate(ROUTES.profile + '/' + profile.url)
  }

  const updateProfilePicture = (picture: string) => {
    if (!profile) return
    queryClient.setQueryData<Profile>(
      queryKeys.profiles.byUrl(profile.url),
      (current) => (current ? { ...current, picture } : current)
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    try {
      await updateMutation.mutateAsync()
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
    profileQuery,
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
