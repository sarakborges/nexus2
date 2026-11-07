import { useQuery, useQueryClient } from '@tanstack/react-query'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'

import { type FormEvent, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useCommunityAccess, useUpdateCommunityMutation } from '@/Hooks/Community'
import { useEntityFormDraft } from '@/Hooks/Forms'
import { useTranslations } from '@/Hooks/Language'
import { uploadEditorImage } from '@/Services/Uploads'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { getCommunityByUrl } from '@/Services/Community'
import { getApiErrorCode } from '@/Services/Http/api'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import type { UseEditCommunityPageResult } from './useEditCommunityPage.types'

export function useEditCommunityPage(): UseEditCommunityPageResult {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAuthStore((state) => state.session)
  const showToast = useToastStore((state) => state.showToast)
  const requestedUrl = normalizeEntityUrl(url)

  const communityQuery = useQuery({
    queryKey: queryKeys.communities.byUrl(requestedUrl),
    queryFn: () => getCommunityByUrl(requestedUrl),
    enabled: Boolean(requestedUrl)
  })
  const community = communityQuery.data
  const typeCompatibility = useProfileTypeCompatibility(
    community?.type ?? 'social'
  )
  const { relationshipsQuery, ownerProfileId } = useCommunityAccess({
    communityId: community?.id ?? null,
    viewerUserId: session?.user.id ?? null,
    profileIds: session?.user.profiles ?? [],
    enabled: Boolean(community?.id && session?.user.id)
  })
  const initialForm = useMemo(
    () =>
      community
        ? {
            name: community.name,
            url: community.url,
            about: community.about,
            privacy: community.privacy ?? 'public'
          }
        : null,
    [community]
  )
  const { form, updateForm } = useEntityFormDraft(
    community?.id ?? null,
    initialForm
  )
  const [errorMessage, setErrorMessage] = useState('')
  const updateMutation = useUpdateCommunityMutation()

  const updateCommunityPicture = (picture: string) => {
    if (!community) return
    queryClient.setQueryData(
      queryKeys.communities.byUrl(community.url),
      (current: typeof community | undefined) =>
        current ? { ...current, picture } : current
    )
  }

  const cancelEdit = () => {
    if (community) navigate(ROUTES.community + '/' + community.url)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    if (!community || !form) return

    try {
      const updated = await updateMutation.mutateAsync({
        communityId: community.id,
        input: {
          name: form.name,
          url: form.url || undefined,
          picture: community.picture,
          about: form.about,
          privacy: form.privacy
        }
      })
      showToast(t('TOAST_COMMUNITY_UPDATED'))
      navigate(ROUTES.community + '/' + updated.url, { replace: true })
    } catch (error) {
      const code = getApiErrorCode(error)
      const key =
        code === 'COMMUNITY_URL_ALREADY_IN_USE'
          ? 'COMMUNITY_ERROR_URL_TAKEN'
          : code === 'INVALID_COMMUNITY'
            ? 'COMMUNITY_ERROR_INVALID'
            : 'COMMUNITY_UPDATE_ERROR'
      setErrorMessage(t(key))
      showToast(t(key), 'error')
    }
  }

  return {
    requestedUrl,
    communityQuery,
    community,
    typeCompatibility,
    relationshipsQuery,
    ownerProfileId,
    form,
    errorMessage,
    isSubmitting: updateMutation.isPending,
    updateForm,
    updateCommunityPicture,
    cancelEdit,
    handleSubmit,
    uploadEditorImage
  }
}
