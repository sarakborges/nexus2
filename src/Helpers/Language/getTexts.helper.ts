import * as EnTexts from '@/GameData/Texts/En'

import { useSettingsStore } from '@/Stores/Settings.store'

export const getTexts = (
  key: string,
  replace?: Record<string, string>
): string => {
  const settings = useSettingsStore.getState().settings
  const lang = settings?.language || 'en'

  const translations = {
    en: { ...EnTexts }
  }

  const value = translations[lang]?.[key]

  if (!value) {
    console.warn('Text not found!', key)
    return ''
  }

  if (!replace) {
    return value
  }

  return Object.keys(replace).reduce(
    (text, replaceKey) => text.replaceAll(replaceKey, replace[replaceKey]),
    value
  )
}
