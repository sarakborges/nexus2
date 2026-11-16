import type { ListSort, PaginatedResult, SearchResultItem, SearchScope } from '../repository.types'

export interface SearchRepository {
  searchEntities(query: string, scope: SearchScope, page: number, sort: ListSort): Promise<PaginatedResult<SearchResultItem>>
}
