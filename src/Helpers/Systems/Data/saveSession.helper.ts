import {
  getBrowserStorage,
  getStorageKey,
  saveStorage
} from '@/Helpers/Systems/Storage'

export const saveSession = ({
  key,
  value
}: {
  key: string
  value: unknown
}): boolean =>
  saveStorage(getBrowserStorage('session'), getStorageKey(key), value)
