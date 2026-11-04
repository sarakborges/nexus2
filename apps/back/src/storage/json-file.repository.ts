import { Injectable } from '@nestjs/common'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { DataRepository } from './repository.interface'

@Injectable()
export class JsonFileRepository implements DataRepository {
  private static readonly locks = new Map<string, Promise<void>>()
  private readonly directory = process.env.DATA_DIRECTORY ?? join(process.cwd(), 'data')

  async read<T>(collection: string): Promise<T[]> {
    const path = this.getPath(collection)
    try {
      const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
      return Array.isArray(parsed) ? parsed as T[] : []
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }

  async update<T>(collection: string, updater: (records: T[]) => T[]): Promise<T[]> {
    const path = this.getPath(collection)
    const previous = JsonFileRepository.locks.get(path) ?? Promise.resolve()
    let release!: () => void
    const currentLock = new Promise<void>(resolve => { release = resolve })
    const queued = previous.then(() => currentLock)
    JsonFileRepository.locks.set(path, queued)

    await previous
    try {
      const current = await this.read<T>(collection)
      const mutable = structuredClone(current)
      const next = updater(mutable)
      if (!Array.isArray(next)) throw new Error('Collection updater must return an array.')
      if (next === mutable) return current
      await this.persist(path, next)
      return structuredClone(next)
    } finally {
      release()
      if (JsonFileRepository.locks.get(path) === queued) {
        JsonFileRepository.locks.delete(path)
      }
    }
  }

  private async persist(destination: string, records: unknown[]): Promise<void> {
    await mkdir(this.directory, { recursive: true })
    const temporary = destination + '.' + randomUUID() + '.tmp'
    await writeFile(temporary, JSON.stringify(records, null, 2), { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, destination)
  }

  private getPath(collection: string): string {
    if (!/^[a-z0-9_-]+$/i.test(collection)) throw new Error('Invalid collection name')
    return join(this.directory, collection + '.json')
  }
}
