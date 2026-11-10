export const DATA_REPOSITORY = Symbol('DATA_REPOSITORY')

export type CollectionRecordMap = Record<string, unknown[]>

export type CollectionTransaction<T> = {
  records: CollectionRecordMap
  result: T
}

/**
 * Collection updaters and transaction callbacks must be synchronous and free
 * of external side effects. Optimistic database transactions may rerun them
 * after a concurrent commit.
 */
export interface DataRepository {
  read<T>(collection: string): Promise<T[]>
  readByIds<T extends { id: string }>(collection: string, ids: readonly string[]): Promise<T[]>
  update<T>(collection: string, updater: (records: T[]) => T[]): Promise<T[]>
  transaction<T>(
    collections: readonly string[],
    updater: (records: CollectionRecordMap) => CollectionTransaction<T>
  ): Promise<T>
}
