import { useCallback, useState } from 'react'

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
  const form =
    entityId && draft?.entityId === entityId ? draft.form : initialForm

  const updateForm = useCallback(
    (patch: Partial<TForm>) => {
      setDraft((current) => {
        const currentForm =
          current?.entityId === entityId ? current.form : initialForm

        if (!entityId || !currentForm) return current

        return {
          entityId,
          form: { ...currentForm, ...patch }
        }
      })
    },
    [entityId, initialForm]
  )

  return { form, updateForm }
}
