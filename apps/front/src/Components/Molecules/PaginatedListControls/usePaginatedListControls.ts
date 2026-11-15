import { useState } from 'react'

import type {
  PaginatedListSearchDraft,
  UsePaginatedListControlsOptions,
  UsePaginatedListControlsResult
} from './usePaginatedListControls.types'

export function usePaginatedListControls({
  query,
  onQueryChange
}: UsePaginatedListControlsOptions): UsePaginatedListControlsResult {
  const [draft, setDraft] = useState<PaginatedListSearchDraft | null>(null)
  const value = draft?.sourceQuery === query ? draft.value : query

  return {
    value,
    setValue: nextValue => setDraft({
      sourceQuery: query,
      value: nextValue
    }),
    isUnchanged: value.trim() === query.trim(),
    submit: event => {
      event.preventDefault()
      onQueryChange(value)
    }
  }
}
