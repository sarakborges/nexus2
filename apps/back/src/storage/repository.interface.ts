export const DATA_REPOSITORY = Symbol('DATA_REPOSITORY')
export interface DataRepository {
  read<T>(collection: string): Promise<T[]>
  write<T>(collection: string, records: T[]): Promise<void>
}
