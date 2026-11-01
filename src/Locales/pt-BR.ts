import type { enUSTranslations } from './en-US'

export const ptBRTranslations = {
  SETTINGS_TITLE: 'Configurações',
  LANGUAGES_TITLE: 'Idioma preferido',
  LANGUAGE_SYSTEM: 'Usar idioma do sistema',
  LANGUAGE_PT_BR: 'Português (Brasil)',
  LANGUAGE_EN_US: 'Inglês (Estados Unidos)',
  THEME_SYSTEM: 'Usar aparência do sistema',
  THEME_LIGHT: 'Claro',
  THEME_DARK: 'Escuro'
} satisfies Record<keyof typeof enUSTranslations, string>
