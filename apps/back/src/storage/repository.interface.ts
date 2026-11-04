export const DATA_REPOSITORY = Symbol('DATA_REPOSITORY')

/**
 * Atomically applies a synchronous transformation to one collection.
 * The updater may run more than once after a concurrent write, so it must
 * not perform external side effects.
 */
export interface DataRepository {
  read<T>(collection: string): Promise<T[]>
  update<T>(collection: string, updater: (records: T[]) => T[]): Promise<T[]>
}
