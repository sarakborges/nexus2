import type { Community, CommunityEditPageData } from '@nexus/common'
import { useQueryClient } from '@tanstack/react-query'

import { type FormEvent, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'
import { ROUTES } from '@/Constants/routes'
import { useUpdateCommunityMutation } from '@/Hooks/Community'
import { useEntityEditPageState } from '@/Hooks/Forms'
import { useTranslations } from '@/Hooks/Language'
import { uploadEditorImage } from '@/Services/Uploads'
import { getApiErrorCode } from '@/Services/Http/api'
import { getCommunityEditPage } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import type { CommunityForm } from './EditCommunityPage.types'
import type { UseEditCommunityPageResult } from './useEditCommunityPage.types'

function createCommunityEditForm(community: Community): CommunityForm {
  return {
    name: community.name,
    url: community.url,
    about: community.about,
    privacy: community.privacy ?? 'public'
  }
}

export function useEditCommunityPage(): UseEditCommunityPageResult {
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

  const editState = useEntityEditPageState<CommunityEditPageData, Community, CommunityForm>({
    queryKey: queryKeys.communityEditPage(
      requestedUrl,
      viewerUserId,
      currentProfileId
    ),
    queryFn: () => getCommunityEditPage(requestedUrl),
    enabled: Boolean(requestedUrl && isAuthInitialized),
    currentProfileId,
    selectEntity: (data) => data.community,
    getEntityId: (community) => community.id,
    getEntityType: (community) => community.type,
    getCurrentProfileType: (data) => data.currentProfileType,
    createInitialForm: createCommunityEditForm
  })
  const communityEditPageQuery = editState.query
  const community = editState.entity
  const ownerProfileId = communityEditPageQuery.data?.ownerProfileId ?? null
  const typeCompatibility = editState.typeCompatibility
  const { form, updateForm } = editState
  const [errorMessage, setErrorMessage] = useState('')
  const updateMutation = useUpdateCommunityMutation()

  const updateCommunityPicture = (picture: string) => {
    if (!community) return
    queryClient.setQueryData(
      queryKeys.communityEditPage(
        requestedUrl,
        viewerUserId,
        currentProfileId
      ),
      (current: typeof communityEditPageQuery.data) =>
        current?.community
          ? { ...current, community: { ...current.community, picture } }
          : current
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
    communityEditPageQuery,
    community,
    typeCompatibility,
    ownerProfileId,
    isAuthInitialized,
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
