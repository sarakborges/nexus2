import type { DataRepository } from './repository.interface'

type CollectionRow = {
  records?: unknown
  updated_at?: unknown
}

type CollectionSnapshot<T> = {
  records: T[]
  updatedAt: string | null
}

const MAX_UPDATE_ATTEMPTS = 8

export class SupabaseRestRepository implements DataRepository {
  private readonly endpoint: string

  constructor(
    projectUrl: string,
    private readonly publishableKey: string,
    private readonly apiSecret: string
  ) {
    this.endpoint = projectUrl.replace(/\/+$/, '') + '/rest/v1/nexus_collections'
  }

  async read<T>(collection: string): Promise<T[]> {
    return (await this.readSnapshot<T>(collection)).records
  }

  async update<T>(collection: string, updater: (records: T[]) => T[]): Promise<T[]> {
    this.assertCollectionName(collection)

    for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt += 1) {
      const snapshot = await this.readSnapshot<T>(collection)
      const currentRecords = structuredClone(snapshot.records)
      const nextRecords = updater(currentRecords)
      if (!Array.isArray(nextRecords)) {
        throw new Error('Collection updater must return an array.')
      }
      if (nextRecords === currentRecords) return snapshot.records

      const updatedAt = this.nextUpdatedAt(snapshot.updatedAt)
      const response = snapshot.updatedAt === null
        ? await this.insertCollection(collection, nextRecords, updatedAt)
        : await this.compareAndSwapCollection(collection, snapshot.updatedAt, nextRecords, updatedAt)

      if (response === 'conflict') {
        await this.backoff(attempt)
        continue
      }

      return response
    }

    throw new Error(
      'Concurrent updates prevented collection "' + collection +
      '" from being saved after ' + MAX_UPDATE_ATTEMPTS + ' attempts.'
    )
  }

  private async readSnapshot<T>(collection: string): Promise<CollectionSnapshot<T>> {
    this.assertCollectionName(collection)

    const url = new URL(this.endpoint)
    url.searchParams.set('select', 'records,updated_at')
    url.searchParams.set('collection', 'eq.' + collection)
    url.searchParams.set('limit', '1')

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers()
    })
    await this.assertSuccess(response)

    const rows = await response.json() as CollectionRow[]
    if (!Array.isArray(rows) || rows.length === 0) return { records: [], updatedAt: null }
    if (rows.length !== 1) {
      throw new Error('Supabase collection "' + collection + '" returned more than one row.')
    }

    const records = rows[0]?.records
    const updatedAt = rows[0]?.updated_at
    if (!Array.isArray(records) || typeof updatedAt !== 'string' || !Number.isFinite(Date.parse(updatedAt))) {
      throw new Error('Supabase collection "' + collection + '" contains an invalid snapshot.')
    }

    return { records: records as T[], updatedAt }
  }

  private async insertCollection<T>(
    collection: string,
    records: T[],
    updatedAt: string
  ): Promise<T[] | 'conflict'> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ collection, records, updated_at: updatedAt })
    })

    if (response.status === 409) return 'conflict'
    await this.assertSuccess(response)
    await this.readRepresentation(response, collection)
    return records
  }

  private async compareAndSwapCollection<T>(
    collection: string,
    expectedUpdatedAt: string,
    records: T[],
    updatedAt: string
  ): Promise<T[] | 'conflict'> {
    const url = new URL(this.endpoint)
    url.searchParams.set('collection', 'eq.' + collection)
    url.searchParams.set('updated_at', 'eq.' + expectedUpdatedAt)

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ records, updated_at: updatedAt })
    })

    if (response.status === 409) return 'conflict'
    await this.assertSuccess(response)

    const rows = await response.json() as CollectionRow[]
    if (!Array.isArray(rows) || rows.length === 0) return 'conflict'
    if (rows.length !== 1 || !Array.isArray(rows[0]?.records)) {
      throw new Error('Supabase collection "' + collection + '" returned an invalid update representation.')
    }

    return rows[0].records as T[]
  }

  private async readRepresentation(response: Response, collection: string): Promise<void> {
    const rows = await response.json() as CollectionRow[]
    if (!Array.isArray(rows) || rows.length !== 1 || !Array.isArray(rows[0]?.records)) {
      throw new Error('Supabase collection "' + collection + '" returned an invalid insert representation.')
    }
  }

  private nextUpdatedAt(previous: string | null): string {
    const previousTime = previous ? Date.parse(previous) : 0
    if (previous && !Number.isFinite(previousTime)) {
      throw new Error('Supabase collection returned an invalid updated_at value.')
    }
    return new Date(Math.max(Date.now(), previousTime + 1)).toISOString()
  }

  private async backoff(attempt: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, Math.min(5 * (attempt + 1), 40)))
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
    throw new Error('Supabase storage request failed (' + response.status + '): ' + details)
  }
}
