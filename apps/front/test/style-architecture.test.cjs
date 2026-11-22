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

test('Nexus control theme uses tokens instead of redeclaring Button and Input base styles', () => {
  const theme = readFileSync(path.join(sourceRoot, 'Assets/Themes/nexus.theme.css'), 'utf8')
  const button = readFileSync(
    path.join(sourceRoot, 'DesignSystem/Atoms/Button/Button.style.scss'),
    'utf8'
  )
  const input = readFileSync(
    path.join(sourceRoot, 'DesignSystem/Atoms/Input/Input.style.scss'),
    'utf8'
  )

  assert.ok(theme.includes('--nexus-button-font-size: 15px'))
  assert.ok(theme.includes('--nexus-button-font-weight: 500'))
  assert.ok(button.includes('font-size: var(--nexus-button-font-size, 14px)'))
  assert.ok(button.includes('font-weight: var(--nexus-button-font-weight, 400)'))
  assert.ok(button.includes('box-shadow: var(--nexus-control-shadow-hover)'))
  assert.ok(button.includes('box-shadow: var(--nexus-control-shadow-pressed)'))
  assert.ok(button.includes('var(--nexus-button-primary-active-background, var(--color-secondary-strong))'))
  assert.ok(input.includes('border-color: var(--nexus-input-focus-border, var(--color-primary-weak))'))
  assert.ok(input.includes('box-shadow: var(--nexus-input-focus-shadow, 0 0 0 2px var(--nexus-accent-glow))'))

  for (const selector of [
    '.button {',
    '.button--primary {',
    '.button--secondary {',
    '.button--cancel {',
    '.input {'
  ]) {
    assert.equal(theme.includes(selector), false, `${selector} must be owned by its component`)
  }
})


test('modal close control has a single component-scoped size definition', () => {
  const modal = readFileSync(
    path.join(sourceRoot, 'DesignSystem/Organisms/Modal/Modal.style.scss'),
    'utf8'
  )

  assert.equal(modal.split('&__close {').length - 1, 2)
  assert.equal(modal.includes('.modal__close {'), false)
  assert.ok(modal.includes('width: var(--nexus-icon-button-size, 40px)'))
  assert.ok(modal.includes('height: var(--nexus-icon-button-size, 40px)'))
})


test('shared form error atom replaces legacy auth-specific error classes', () => {
  const obsoleteClasses = ['auth-card__error', 'form-field__error']
  const references = codeFiles.flatMap(file => {
    const content = readFileSync(file, 'utf8')
    return obsoleteClasses
      .filter(className => content.includes(className))
      .map(className => ({ file, className }))
  })

  assert.deepEqual(references, [])
})


test('Nexus theme contains no unconsumed tokens or obsolete auth-card selectors', () => {
  const themePath = path.join(sourceRoot, 'Assets/Themes/nexus.theme.css')
  const unusedTokens = ['--nexus-control-shadow', '--nexus-accent-highlight']
  const tokenReferences = sourceFiles.flatMap(file => {
    if (file === themePath) return []
    const content = readFileSync(file, 'utf8')
    return unusedTokens
      .filter(token => [
        `var(${token})`,
        `var(${token},`,
        `getPropertyValue('${token}')`,
        `getPropertyValue("${token}")`,
        `setProperty('${token}'`,
        `setProperty("${token}"`
      ].some(reference => content.includes(reference)))
      .map(token => ({ file, token }))
  })
  const authCardReferences = codeFiles.filter(file =>
    readFileSync(file, 'utf8').includes('auth-card')
  )

  assert.deepEqual(tokenReferences, [])
  assert.deepEqual(authCardReferences, [])
})


test('entity directory styles are nested under the owning AccountCard block', () => {
  const styles = readFileSync(
    path.join(sourceRoot, 'Components/Organisms/EntityDirectoryGrid/EntityDirectoryGrid.style.scss'),
    'utf8'
  )

  assert.ok(styles.startsWith('.account-card {'))
  assert.ok(styles.includes('&__profile-entry {'))
  assert.ok(styles.includes('&--card {'))
  assert.equal(styles.includes('.account-card__profile-entry {'), false)
})


test('community page and member directory styles use component-scoped BEM nesting', () => {
  const forumPreviewStyles = readFileSync(
    path.join(sourceRoot, 'Components/Organisms/CommunityPageForumPreview/CommunityPageForumPreview.style.scss'),
    'utf8'
  )
  const memberDirectoryStyles = readFileSync(
    path.join(sourceRoot, 'Components/Organisms/CommunityMemberDirectory/CommunityMemberDirectory.style.scss'),
    'utf8'
  )

  assert.ok(forumPreviewStyles.startsWith('.community-page {'))
  assert.ok(forumPreviewStyles.includes('&__forum {'))
  assert.equal(forumPreviewStyles.includes('.community-page__forum {'), false)

  assert.ok(memberDirectoryStyles.startsWith('.community-member-directory {'))
  assert.ok(memberDirectoryStyles.includes('&__tabs {'))
  assert.equal(memberDirectoryStyles.includes('.community-member-directory__tabs {'), false)
})
