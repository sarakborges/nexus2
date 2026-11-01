import {
  getBrowserStorage,
  getStorageKey,
  loadStorage
} from '@/Helpers/Systems/Storage'

export const loadSession = <T>(key: string): T | null =>
  loadStorage<T>(getBrowserStorage('session'), getStorageKey(key))
