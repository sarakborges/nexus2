import type { CommunityPrivacy } from '@nexus/common'
import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useEntityDetailsDraft } from '@/Hooks/Forms'
import { useCreateCommunityMutation } from '@/Hooks/Community'
import { useTranslations } from '@/Hooks/Language'
import { getApiErrorCode } from '@/Services/Http/api'
import { uploadEditorImage } from '@/Services/Uploads'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import type { UseCreateCommunityPageResult } from './useCreateCommunityPage.types'

export function useCreateCommunityPage(): UseCreateCommunityPageResult {
  const navigate = useNavigate()
  const { t } = useTranslations()
  const session = useAuthStore((state) => state.session)
  const ownerProfileId = session?.user.currentProfile ?? null
  const showToast = useToastStore((state) => state.showToast)
  const { name, setName, url, setUrl, picture, setPicture, about, setAbout } =
    useEntityDetailsDraft()
  const [privacy, setPrivacy] = useState<CommunityPrivacy>('public')
  const [errorMessage, setErrorMessage] = useState('')
  const createCommunityMutation = useCreateCommunityMutation()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')

    if (!session) {
      navigate(ROUTES.signIn, { replace: true })
      return
    }
    if (!ownerProfileId) {
      navigate(ROUTES.createProfile, { replace: true })
      return
    }

    try {
      const community = await createCommunityMutation.mutateAsync({
        input: {
          name,
          url: url || undefined,
          picture,
          about,
          privacy
        },
        ownerProfileId
      })
      showToast(t('TOAST_COMMUNITY_CREATED'))
      navigate(`${ROUTES.community}/${community.url}`, { replace: true })
    } catch (error) {
      const code = getApiErrorCode(error)
      const key =
        code === 'COMMUNITY_URL_ALREADY_IN_USE'
          ? 'COMMUNITY_ERROR_URL_TAKEN'
          : code === 'INVALID_COMMUNITY'
            ? 'COMMUNITY_ERROR_INVALID'
            : code === 'OWNER_PROFILE_REQUIRED'
              ? 'COMMUNITY_ERROR_OWNER_REQUIRED'
              : 'COMMUNITY_ERROR_GENERIC'
      setErrorMessage(t(key))
      showToast(t(key), 'error')
    }
  }

  return {
    name,
    setName,
    url,
    setUrl,
    picture,
    setPicture,
    about,
    setAbout,
    privacy,
    setPrivacy,
    errorMessage,
    isSubmitting: createCommunityMutation.isPending,
    handleSubmit,
    handleCancel: () => navigate(ROUTES.home),
    uploadEditorImage
  }
}
