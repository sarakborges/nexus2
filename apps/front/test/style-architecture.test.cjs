const assert = require('node:assert/strict')
const { existsSync, readdirSync, readFileSync } = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const sourceRoot = path.resolve(__dirname, '../src')

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(entryPath) : [entryPath]
  })
}

function walkDirectories(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (!entry.isDirectory()) return []
    const entryPath = path.join(directory, entry.name)
    return [entryPath, ...walkDirectories(entryPath)]
  })
}

const sourceFiles = walk(sourceRoot)
const styleFiles = sourceFiles.filter(file => /\.(?:css|scss|sass)$/i.test(file))
const codeFiles = sourceFiles.filter(file => /\.(?:ts|tsx|js|jsx)$/i.test(file))

test('frontend styles do not use !important', () => {
  const violations = styleFiles.flatMap(file => {
    const content = readFileSync(file, 'utf8')
    return content
      .split(/\r?\n/)
      .map((line, index) => ({ file, line: index + 1, content: line.trim() }))
      .filter(entry => /!important\b/i.test(entry.content))
  })

  assert.deepEqual(violations, [])
})

test('brand and status palette tokens have one source of truth', () => {
  const paletteFiles = [
    'Assets/Themes/main.theme.css',
    'Assets/Themes/light.theme.css',
    'Assets/Themes/dark.theme.css',
    'Assets/Themes/nexus.theme.css'
  ]
  const palette = paletteFiles.map(file => ({
    file,
    content: readFileSync(path.join(sourceRoot, file), 'utf8')
  }))
  const sourceOfTruth = palette[0]
  const tokens = [
    '--color-primary',
    '--color-primary-weak',
    '--color-primary-strong',
    '--color-secondary',
    '--color-secondary-weak',
    '--color-secondary-strong',
    '--color-brand-accent',
    '--color-success',
    '--color-success-weak',
    '--color-success-strong',
    '--color-warning',
    '--color-warning-weak',
    '--color-warning-strong',
    '--color-error',
    '--color-error-weak',
    '--color-error-strong',
    '--color-cancel',
    '--color-cancel-weak',
    '--color-cancel-strong',
    '--color-enemies',
    '--color-allies'
  ]

  for (const token of tokens) {
    const declaration = new RegExp('^\\s*' + token + '\\s*:', 'm')
    assert.match(sourceOfTruth.content, declaration, token + ' must be declared in main.theme.css')

    for (const appearance of palette.slice(1)) {
      assert.doesNotMatch(
        appearance.content,
        declaration,
        token + ' must not be redeclared in ' + appearance.file
      )
    }
  }
})

test('loading indicator provides an accessible reduced-motion-aware spin', () => {
  const indicator = readFileSync(
    path.join(sourceRoot, 'DesignSystem/Atoms/LoadingIndicator/LoadingIndicator.style.scss'),
    'utf8'
  )

  assert.match(indicator, /@keyframes\s+loading-indicator-spin/)
  assert.match(indicator, /animation:\s*loading-indicator-spin\s+800ms\s+linear\s+infinite/)
  assert.match(indicator, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
})

test('reduced-motion reset outranks component-level animation declarations', () => {
  const globalStyles = readFileSync(path.join(sourceRoot, 'Assets/main.css'), 'utf8')
  assert.match(globalStyles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*html:root\s+\*/)
  assert.match(globalStyles, /html:root\s+\*::before/)
  assert.match(globalStyles, /html:root\s+\*::after/)
})

test('source directories use PascalCase consistently', () => {
  const invalidDirectories = walkDirectories(sourceRoot).filter(directory => {
    const name = path.basename(directory)
    return !/^[A-Z][A-Za-z0-9]*$/.test(name)
  })

  assert.deepEqual(invalidDirectories, [])
  assert.ok(existsSync(path.join(sourceRoot, 'Pages')))
  assert.ok(existsSync(path.join(sourceRoot, 'Routes')))
})

test('page and route imports use the standardized directory names', () => {
  const staleImports = codeFiles.flatMap(file => {
    const content = readFileSync(file, 'utf8')
    return /@\/pages\/|@\/routes(?:['"])/.test(content) ? [file] : []
  })

  assert.deepEqual(staleImports, [])
})
