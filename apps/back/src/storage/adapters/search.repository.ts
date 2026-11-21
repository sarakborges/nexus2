import type { ListSort, PaginatedResult, SearchResultItem, SearchScope } from '../repository.types'
import { SupabaseRepositoryClient } from '../supabase-repository.client'
import type { SearchRepository } from '../contracts/search.repository.interface'

export class SupabaseSearchRepository extends SupabaseRepositoryClient implements SearchRepository {
  constructor(projectUrl: string, publishableKey: string, apiSecret: string) {
    super(projectUrl, publishableKey, apiSecret)
  }

  async searchEntities(query: string, scope: SearchScope, page: number, sort: ListSort): Promise<PaginatedResult<SearchResultItem>> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_search_entities', {
      method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_query: query, p_scope: scope, p_page: page, p_sort: sort })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase entity search returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase entity search returned invalid pagination data.')
    }
    return result as PaginatedResult<SearchResultItem>
  }
}
