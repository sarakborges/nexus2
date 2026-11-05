import type { CommunityPrivacy } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { createCommunity } from '@/Services/Community'
import { getApiErrorCode } from '@/Services/Http/api'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'

export function useCreateCommunityPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslations()
  const session = useAuthStore((state) => state.session)
  const ownerProfileId = session?.user.currentProfile ?? null
  const showToast = useToastStore((state) => state.showToast)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [picture, setPicture] = useState('')
  const [about, setAbout] = useState('')
  const [privacy, setPrivacy] = useState<CommunityPrivacy>('public')
  const [errorMessage, setErrorMessage] = useState('')

  const createCommunityMutation = useMutation({
    mutationFn: () =>
      createCommunity(
        { name, url: url || undefined, picture, about, privacy },
        ownerProfileId!
      ),
    onSuccess: async (community) => {
      queryClient.setQueryData(
        queryKeys.communities.byUrl(community.url),
        community
      )
      showToast(t('TOAST_COMMUNITY_CREATED'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['communities', 'list'] }),
        ...(ownerProfileId
          ? [
              queryClient.invalidateQueries({
                queryKey: ['communities', 'by-profile', ownerProfileId]
              })
            ]
          : [])
      ])
    }
  })

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
      const community = await createCommunityMutation.mutateAsync()
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
    handleSubmit
  }
}
