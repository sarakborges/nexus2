import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useEntityFormDraft } from './useEntityFormDraft.hook'
import type {
  UseEntityEditPageStateOptions,
  UseEntityEditPageStateResult
} from './useEntityEditPageState.types'

export function useEntityEditPageState<TData, TEntity, TForm>({
  queryKey,
  queryFn,
  enabled,
  currentProfileId,
  selectEntity,
  getEntityId,
  getEntityType,
  getCurrentProfileType,
  createInitialForm,
  fallbackEntityType = 'social'
}: UseEntityEditPageStateOptions<TData, TEntity, TForm>): UseEntityEditPageStateResult<TData, TEntity, TForm> {
  const query = useQuery({
    queryKey,
    queryFn,
    enabled,
    staleTime: 30 * 1000
  })

  const entity = query.data === undefined ? undefined : selectEntity(query.data)
  const initialForm = useMemo(
    () => (entity ? createInitialForm(entity) : null),
    [entity, createInitialForm]
  )
  const { form, updateForm } = useEntityFormDraft(
    entity ? getEntityId(entity) : null,
    initialForm
  )
  const currentProfileType = query.data
    ? getCurrentProfileType(query.data)
    : null

  return {
    query,
    entity,
    typeCompatibility: {
      isChecking: Boolean(currentProfileId && query.isLoading),
      isCompatible:
        !currentProfileId ||
        (query.isSuccess &&
          currentProfileType ===
            (entity ? getEntityType(entity) : fallbackEntityType))
    },
    form,
    updateForm
  }
}
