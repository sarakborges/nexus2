import type { QueryKey, UseQueryResult } from '@tanstack/react-query'

export type EntityEditTypeCompatibility = {
  isChecking: boolean
  isCompatible: boolean
}

export type UseEntityEditPageStateOptions<TData, TEntity, TForm> = {
  queryKey: QueryKey
  queryFn: () => Promise<TData>
  enabled: boolean
  currentProfileId: string | null
  selectEntity: (data: TData) => TEntity | null
  getEntityId: (entity: TEntity) => string
  getEntityType: (entity: TEntity) => string
  getCurrentProfileType: (data: TData) => string | null
  createInitialForm: (entity: TEntity) => TForm
  fallbackEntityType?: string
}

export type UseEntityEditPageStateResult<TData, TEntity, TForm> = {
  query: UseQueryResult<TData>
  entity: TEntity | null | undefined
  typeCompatibility: EntityEditTypeCompatibility
  form: TForm | null
  updateForm: (patch: Partial<TForm>) => void
}
