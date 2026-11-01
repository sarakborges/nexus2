export default {
  trailingComma: 'none',
  tabWidth: 2,
  semi: false,
  singleQuote: true,
  plugins: ['@trivago/prettier-plugin-sort-imports'],
  importOrder: [
    '^(react|react-dom|react-router)(/.*)?$',
    '^@/',
    '^(.*).scss$',
    '^(.*).css$'
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true
}
