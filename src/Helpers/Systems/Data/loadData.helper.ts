import {
  getBrowserStorage,
  getStorageKey,
  loadStorage
} from '@/Helpers/Systems/Storage'

export const loadData = <T>(key: string): T | null =>
  loadStorage<T>(getBrowserStorage('local'), getStorageKey(key))
