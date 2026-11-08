import type { CollectionRecordMap, DataRepository } from './repository.interface'

type CollectionRow = {
  collection?: unknown
  records?: unknown
  updated_at?: unknown
}

type CollectionSnapshot<T> = {
  records: T[]
  updatedAt: string | null
}

type AtomicCommitResponse = {
  committed?: unknown
}

const MAX_UPDATE_ATTEMPTS = 8

export class SupabaseRestRepository implements DataRepository {
  private readonly endpoint: string
  private readonly transactionEndpoint: string

  constructor(
    projectUrl: string,
    private readonly publishableKey: string,
    private readonly apiSecret: string
  ) {
    const baseUrl = projectUrl.replace(/\/+$/, '')
    this.endpoint = baseUrl + '/rest/v1/nexus_collections'
    this.transactionEndpoint = baseUrl + '/rest/v1/rpc/nexus_commit_collections'
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

  async transaction<T>(
    collections: readonly string[],
    updater: (records: CollectionRecordMap) => { records: CollectionRecordMap; result: T }
  ): Promise<T> {
    const names = this.validateTransactionCollections(collections)

    for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt += 1) {
      const snapshots = await this.readSnapshots(names)

      const current: CollectionRecordMap = {}
      for (const name of names) current[name] = structuredClone(snapshots.get(name)!.records)

      const outcome = updater(current)
      if (!outcome || typeof outcome !== 'object' || !outcome.records || typeof outcome.records !== 'object') {
        throw new Error('Collection transaction must return records and a result.')
      }

      const changes = names.flatMap(name => {
        const records = outcome.records[name]
        if (!Array.isArray(records)) {
          throw new Error('Collection transaction must return an array for "' + name + '".')
        }
        if (records === current[name]) return []
        return [{
          collection: name,
          expected_updated_at: snapshots.get(name)!.updatedAt,
          records
        }]
      })
      if (changes.length === 0) return outcome.result

      const response = await fetch(this.transactionEndpoint, {
        method: 'POST',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_changes: changes })
      })

      if (response.status === 409) {
        await this.backoff(attempt)
        continue
      }
      await this.assertSuccess(response)

      const result = await response.json() as AtomicCommitResponse
      if (result?.committed === true) return outcome.result
      if (result?.committed === false) {
        await this.backoff(attempt)
        continue
      }
      throw new Error('Supabase transaction returned an invalid commit result.')
    }

    throw new Error(
      'Concurrent updates prevented collection transaction (' + names.join(', ') +
      ') from being saved after ' + MAX_UPDATE_ATTEMPTS + ' attempts.'
    )
  }

  private async readSnapshots(
    collections: readonly string[]
  ): Promise<Map<string, CollectionSnapshot<unknown>>> {
    const requested = new Set(collections)
    const url = new URL(this.endpoint)
    url.searchParams.set('select', 'collection,records,updated_at')
    url.searchParams.set('collection', 'in.(' + collections.join(',') + ')')
    url.searchParams.set('limit', String(collections.length))

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers()
    })
    await this.assertSuccess(response)

    const rows = await response.json() as CollectionRow[]
    if (!Array.isArray(rows)) {
      throw new Error('Supabase transaction returned an invalid collection snapshot.')
    }

    const snapshots = new Map<string, CollectionSnapshot<unknown>>()
    for (const row of rows) {
      const name = row.collection
      if (typeof name !== 'string' || !requested.has(name)) {
        throw new Error('Supabase transaction returned an unknown collection.')
      }
      if (snapshots.has(name)) {
        throw new Error('Supabase collection "' + name + '" returned more than one row.')
      }

      const records = row.records
      const updatedAt = row.updated_at
      if (
        !Array.isArray(records) ||
        typeof updatedAt !== 'string' ||
        !Number.isFinite(Date.parse(updatedAt))
      ) {
        throw new Error('Supabase collection "' + name + '" contains an invalid snapshot.')
      }
      snapshots.set(name, { records, updatedAt })
    }

    for (const name of collections) {
      if (!snapshots.has(name)) {
        snapshots.set(name, { records: [], updatedAt: null })
      }
    }

    return snapshots
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

  private validateTransactionCollections(collections: readonly string[]): string[] {
    const names = [...new Set(collections)]
    if (names.length === 0 || names.length !== collections.length) {
      throw new Error('Collection transaction requires a non-empty list of unique collections.')
    }
    for (const name of names) this.assertCollectionName(name)
    return names.sort()
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
