import {
  deleteStorage,
  getBrowserStorage,
  getStorageKey
} from '@/Helpers/Systems/Storage'

export const deleteSession = (key: string): boolean =>
  deleteStorage(getBrowserStorage('session'), getStorageKey(key))
