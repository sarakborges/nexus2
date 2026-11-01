import type { DataRepository } from './repository.interface'

type CollectionRow = { records?: unknown }

export class SupabaseRestRepository implements DataRepository {
  private readonly endpoint: string

  constructor(
    projectUrl: string,
    private readonly publishableKey: string,
    private readonly apiSecret: string
  ) {
    this.endpoint = `${projectUrl.replace(/\/+$/, '')}/rest/v1/nexus_collections`
  }

  async read<T>(collection: string): Promise<T[]> {
    this.assertCollectionName(collection)

    const url = new URL(this.endpoint)
    url.searchParams.set('select', 'records')
    url.searchParams.set('collection', `eq.${collection}`)
    url.searchParams.set('limit', '1')

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers()
    })
    await this.assertSuccess(response)

    const rows = await response.json() as CollectionRow[]
    if (!Array.isArray(rows) || rows.length === 0) return []

    const records = rows[0]?.records
    if (!Array.isArray(records)) {
      throw new Error(`Supabase collection "${collection}" contains an invalid records payload.`)
    }

    return records as T[]
  }

  async write<T>(collection: string, records: T[]): Promise<void> {
    this.assertCollectionName(collection)

    if (!Array.isArray(records)) {
      throw new Error('Collection records must be an array.')
    }

    const response = await fetch(`${this.endpoint}?on_conflict=collection`, {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        collection,
        records,
        updated_at: new Date().toISOString()
      })
    })
    await this.assertSuccess(response)
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.publishableKey,
      'x-nexus-api-secret': this.apiSecret
    }
  }

  private assertCollectionName(collection: string): void {
    if (!/^[a-z0-9_-]+$/i.test(collection)) {
      throw new Error('Invalid collection name')
    }
  }

  private async assertSuccess(response: Response): Promise<void> {
    if (response.ok) return

    const details = await response.text()
    throw new Error(`Supabase storage request failed (${response.status}): ${details}`)
  }
}
