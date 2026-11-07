import { useCallback, useEffect, useState } from 'react'

import type { UseEntityFormDraftResult } from './useEntityFormDraft.types'

type EntityFormDraftState<TForm> = {
  entityId: string
  form: TForm
}

export function useEntityFormDraft<TForm>(
  entityId: string | null,
  initialForm: TForm | null
): UseEntityFormDraftResult<TForm> {
  const [draft, setDraft] = useState<EntityFormDraftState<TForm> | null>(null)

  useEffect(() => {
    if (!entityId || !initialForm) return

    setDraft((current) =>
      current?.entityId === entityId
        ? current
        : { entityId, form: initialForm }
    )
  }, [entityId, initialForm])

  const form = draft?.entityId === entityId ? draft.form : null
  const updateForm = useCallback(
    (patch: Partial<TForm>) => {
      setDraft((current) =>
        current?.entityId === entityId
          ? { ...current, form: { ...current.form, ...patch } }
          : current
      )
    },
    [entityId]
  )

  return { form, updateForm }
}
