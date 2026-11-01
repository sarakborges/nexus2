import {
  deleteStorage,
  getBrowserStorage,
  getStorageKey
} from '@/Helpers/Systems/Storage'

export const deleteData = (key: string): boolean =>
  deleteStorage(getBrowserStorage('local'), getStorageKey(key))
