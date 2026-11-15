import type { FormEventHandler } from 'react'

export type UsePaginatedListControlsOptions = {
  query: string
  onQueryChange: (query: string) => void
}

export type UsePaginatedListControlsResult = {
  value: string
  setValue: (value: string) => void
  isUnchanged: boolean
  submit: FormEventHandler<HTMLFormElement>
}
