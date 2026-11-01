export default {
  trailingComma: 'none',
  tabWidth: 2,
  semi: false,
  singleQuote: true,
  plugins: ['@trivago/prettier-plugin-sort-imports'],
  importOrder: [
    '^(react/(.*)$)|^(react$)',
    '^@/(Types)/',
    '^@/(GameData)/',
    '^@/(Helpers)/',
    '^@/(Consts)/',
    '^@/(Stores)/',
    '^@/(Components)/',
    '^@/(Styles)/',
    '^(.*).scss$',
    '^(.*).css$'
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true
}
