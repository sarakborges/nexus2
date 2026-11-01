import {
  getBrowserStorage,
  getStorageKey,
  saveStorage
} from '@/Helpers/Systems/Storage'

export const saveData = ({
  key,
  value
}: {
  key: string
  value: unknown
}): boolean =>
  saveStorage(getBrowserStorage('local'), getStorageKey(key), value)
