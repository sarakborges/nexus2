import { useCallback, useEffect, useRef, useState } from 'react'

import type { UseEntityFormDraftResult } from './useEntityFormDraft.types'

export function useEntityFormDraft<TForm>(
  entityId: string | null,
  initialForm: TForm | null
): UseEntityFormDraftResult<TForm> {
  const initializedEntityId = useRef<string | null>(null)
  const [form, setForm] = useState<TForm | null>(null)

  useEffect(() => {
    if (!entityId || !initialForm || initializedEntityId.current === entityId) {
      return
    }

    initializedEntityId.current = entityId
    setForm(initialForm)
  }, [entityId, initialForm])

  const updateForm = useCallback((patch: Partial<TForm>) => {
    setForm((current) => (current ? { ...current, ...patch } : current))
  }, [])

  return { form, updateForm }
}
