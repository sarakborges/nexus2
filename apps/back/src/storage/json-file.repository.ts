import { Injectable } from '@nestjs/common'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { DataRepository } from './repository.interface'

@Injectable()
export class JsonFileRepository implements DataRepository {
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
  async write<T>(collection: string, records: T[]): Promise<void> {
    await mkdir(this.directory, { recursive: true })
    const destination = this.getPath(collection)
    const temporary = `${destination}.${randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify(records, null, 2), { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, destination)
  }
  private getPath(collection: string): string {
    if (!/^[a-z0-9_-]+$/i.test(collection)) throw new Error('Invalid collection name')
    return join(this.directory, `${collection}.json`)
  }
}
