import type { DataRepository } from './repository.interface'

type CollectionResult = unknown

export class SupabaseRestRepository implements DataRepository {
  private readonly endpoint: string

  constructor(
    projectUrl: string,
    private readonly publishableKey: string,
    private readonly apiSecret: string
  ) {
    this.endpoint = `${projectUrl.replace(/\/+$/, '')}/rest/v1/rpc`
  }

  async read<T>(collection: string): Promise<T[]> {
    this.assertCollectionName(collection)

    const result = await this.call<CollectionResult>('nexus_read_collection', {
      p_collection: collection,
      p_secret: this.apiSecret
    })

    if (!Array.isArray(result)) {
      throw new Error(`Supabase collection "${collection}" returned an invalid records payload.`)
    }

    return result as T[]
  }

  async write<T>(collection: string, records: T[]): Promise<void> {
    this.assertCollectionName(collection)

    if (!Array.isArray(records)) {
      throw new Error('Collection records must be an array.')
    }

    const result = await this.call<unknown>('nexus_write_collection', {
      p_collection: collection,
      p_records: records,
      p_secret: this.apiSecret
    })

    if (result !== true) {
      throw new Error(`Supabase collection "${collection}" was not saved.`)
    }
  }

  private async call<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.endpoint}/${functionName}`, {
      method: 'POST',
      headers: {
        apikey: this.publishableKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const details = await response.text()
      throw new Error(`Supabase RPC request failed (${response.status}): ${details}`)
    }

    return await response.json() as T
  }

  private assertCollectionName(collection: string): void {
    if (!/^[a-z0-9_-]+$/i.test(collection)) {
      throw new Error('Invalid collection name')
    }
  }
}
