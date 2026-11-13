import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'
import type { ProfileSettings } from '@nexus/common'

import { getProfileByUrl } from '@/Services/Profile/profile.service'
import { getProfileSettings, saveProfileSettings } from '@/Services/ProfileSettings'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type { ProfileActivityType, UseProfileSettingsPageResult } from './useProfileSettingsPage.types'

const DEFAULT_SETTINGS: ProfileSettings = {
  messageAudience: 'everyone',
  publishActivityTypes: [
    'friend_connected',
    'profile_post',
    'community_created',
    'community_membership'
  ],
  showFriendActivityTypes: [
    'friend_connected',
    'profile_post',
    'community_created',
    'community_membership'
  ]
}

export function useProfileSettingsPage(profileUrl?: string): UseProfileSettingsPageResult {
  const routeParams = useParams()
  const url = profileUrl ?? routeParams.url ?? ''
  const userId = useAuthStore(state => state.session?.user.id ?? null)
  const queryClient = useQueryClient()
  const queryKey = queryKeys.profileSettings(url, userId ?? '')
  const [draft, setDraft] = useState<{ profileId: string; value: ProfileSettings } | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const profile = await getProfileByUrl(url)
      if (!profile) throw new Error('PROFILE_NOT_FOUND')
      return { profile, settings: await getProfileSettings(profile.id) }
    },
    enabled: Boolean(url && userId),
    staleTime: 30_000
  })

  const settings = draft && query.data && draft.profileId === query.data.profile.id
    ? draft.value
    : query.data?.settings ?? DEFAULT_SETTINGS

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!query.data) throw new Error('PROFILE_NOT_FOUND')
      return saveProfileSettings(query.data.profile.id, settings)
    },
    onMutate: () => setSaveSuccess(false),
    onSuccess: saved => {
      queryClient.setQueryData(queryKey, current =>
        current ? { ...current, settings: saved } : current
      )
      setDraft({ profileId: query.data?.profile.id ?? '', value: saved })
      setSaveSuccess(true)
    }
  })

  const isDirty = Boolean(
    query.data && JSON.stringify(settings) !== JSON.stringify(query.data.settings)
  )

  const toggleActivityType = (
    field: 'publishActivityTypes' | 'showFriendActivityTypes',
    type: ProfileActivityType
  ) => {
    setSaveSuccess(false)
    setDraft(current => {
      const base = current && query.data && current.profileId === query.data.profile.id
        ? current.value
        : query.data?.settings ?? DEFAULT_SETTINGS

      return {
        profileId: query.data?.profile.id ?? '',
        value: {
          ...base,
          [field]: base[field].includes(type)
            ? base[field].filter(item => item !== type)
            : [...base[field], type]
        }
      }
    })
  }

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    profileName: query.data?.profile.name ?? '',
    settings,
    isSaving: saveMutation.isPending,
    isDirty,
    saveError: saveMutation.isError,
    saveSuccess,
    setMessageAudience: value => {
      setSaveSuccess(false)
      setDraft(current => {
        const base = current && query.data && current.profileId === query.data.profile.id
          ? current.value
          : query.data?.settings ?? DEFAULT_SETTINGS

        return {
          profileId: query.data?.profile.id ?? '',
          value: { ...base, messageAudience: value }
        }
      })
    },
    toggleActivityType,
    save: () => saveMutation.mutate(),
    retry: () => void query.refetch()
  }
}
