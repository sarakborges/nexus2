import { Injectable } from '@nestjs/common'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { CollectionRecordMap, DataRepository } from './repository.interface'

@Injectable()
export class JsonFileRepository implements DataRepository {
  private static readonly locks = new Map<string, Promise<void>>()
  private readonly directory = process.env.DATA_DIRECTORY ?? join(process.cwd(), 'data')

  async read<T>(collection: string): Promise<T[]> {
    const path = this.getPath(collection)
    return this.withLocks([path], async () => this.readUnlocked<T>(path))
  }

  async update<T>(collection: string, updater: (records: T[]) => T[]): Promise<T[]> {
    const path = this.getPath(collection)
    return this.withLocks([path], async () => {
      const current = await this.readUnlocked<T>(path)
      const mutable = structuredClone(current)
      const next = updater(mutable)
      if (!Array.isArray(next)) throw new Error('Collection updater must return an array.')
      if (next === mutable) return current
      await this.persist(path, next)
      return structuredClone(next)
    })
  }

  async transaction<T>(
    collections: readonly string[],
    updater: (records: CollectionRecordMap) => { records: CollectionRecordMap; result: T }
  ): Promise<T> {
    const names = this.validateTransactionCollections(collections)
    const paths = names.map(name => this.getPath(name))
    return this.withLocks(paths, async () => {
      const current: CollectionRecordMap = {}
      for (const name of names) current[name] = await this.readUnlocked(this.getPath(name))

      const working: CollectionRecordMap = structuredClone(current)
      const outcome = updater(working)
      if (!outcome || typeof outcome !== 'object' || !outcome.records || typeof outcome.records !== 'object') {
        throw new Error('Collection transaction must return records and a result.')
      }

      const changed = names.filter(name => {
        const next = outcome.records[name]
        if (!Array.isArray(next)) throw new Error('Collection transaction must return an array for "' + name + '".')
        return next !== working[name]
      })
      if (changed.length === 0) return outcome.result

      const changedPaths = changed.map(name => this.getPath(name))
      const originals = new Map<string, string | null>()
      for (const path of changedPaths) {
        try {
          originals.set(path, await readFile(path, 'utf8'))
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          originals.set(path, null)
        }
      }

      const staged = new Map<string, string>()
      const replaced: string[] = []
      try {
        await mkdir(this.directory, { recursive: true })
        for (const name of changed) {
          const path = this.getPath(name)
          const temporary = path + '.' + randomUUID() + '.tmp'
          await writeFile(temporary, JSON.stringify(outcome.records[name], null, 2), {
            encoding: 'utf8',
            mode: 0o600
          })
          staged.set(path, temporary)
        }
        for (const path of changedPaths) {
          await rename(staged.get(path)!, path)
          replaced.push(path)
        }
      } catch (error) {
        const rollbackErrors: unknown[] = []
        for (const path of replaced.reverse()) {
          try {
            const original = originals.get(path)
            if (original === null) {
              await unlink(path)
            } else {
              const temporary = path + '.' + randomUUID() + '.rollback'
              await writeFile(temporary, original, { encoding: 'utf8', mode: 0o600 })
              await rename(temporary, path)
            }
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError)
          }
        }
        for (const temporary of staged.values()) {
          try { await unlink(temporary) } catch { /* A renamed temp no longer exists. */ }
        }
        if (rollbackErrors.length > 0) {
          throw new AggregateError([error, ...rollbackErrors], 'Collection transaction and rollback failed.')
        }
        throw error
      }

      return outcome.result
    })
  }

  private async withLocks<T>(paths: string[], operation: () => Promise<T>): Promise<T> {
    const releases: Array<{ path: string; queued: Promise<void>; release: () => void }> = []
    for (const path of [...new Set(paths)].sort()) {
      const previous = JsonFileRepository.locks.get(path) ?? Promise.resolve()
      let release!: () => void
      const currentLock = new Promise<void>(resolve => { release = resolve })
      const queued = previous.then(() => currentLock)
      JsonFileRepository.locks.set(path, queued)
      await previous
      releases.push({ path, queued, release })
    }

    try {
      return await operation()
    } finally {
      for (const lock of releases.reverse()) {
        lock.release()
        if (JsonFileRepository.locks.get(lock.path) === lock.queued) {
          JsonFileRepository.locks.delete(lock.path)
        }
      }
    }
  }

  private async readUnlocked<T>(path: string): Promise<T[]> {
    try {
      const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
      return Array.isArray(parsed) ? parsed as T[] : []
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }

  private async persist(destination: string, records: unknown[]): Promise<void> {
    await mkdir(this.directory, { recursive: true })
    const temporary = destination + '.' + randomUUID() + '.tmp'
    await writeFile(temporary, JSON.stringify(records, null, 2), { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, destination)
  }

  private validateTransactionCollections(collections: readonly string[]): string[] {
    const names = [...new Set(collections)]
    if (names.length === 0 || names.length !== collections.length) {
      throw new Error('Collection transaction requires a non-empty list of unique collections.')
    }
    for (const name of names) this.getPath(name)
    return names.sort()
  }

  private getPath(collection: string): string {
    if (!/^[a-z0-9_-]+$/i.test(collection)) throw new Error('Invalid collection name')
    return join(this.directory, collection + '.json')
  }
}
