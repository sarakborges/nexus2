const assert = require('node:assert/strict')
const path = require('node:path')
const { Module } = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')

function loadTypeScriptModule(relativePath) {
  const filename = path.resolve(__dirname, '../src', relativePath)
  const source = require('node:fs').readFileSync(filename, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    },
    reportDiagnostics: true
  })

  const errors = (compiled.diagnostics ?? []).filter(
    diagnostic => diagnostic.category === ts.DiagnosticCategory.Error
  )
  assert.deepEqual(errors, [], 'TypeScript utility should transpile without diagnostics')

  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  loaded._compile(compiled.outputText, filename)
  return loaded.exports
}

test('normalizeEntityUrl trims whitespace, removes a leading @ and lowercases', () => {
  const { normalizeEntityUrl } = loadTypeScriptModule('Utils/entityUrl.utils.ts')

  assert.equal(normalizeEntityUrl('  @Sara.B  '), 'sara.b')
  assert.equal(normalizeEntityUrl('Community-42'), 'community-42')
  assert.equal(normalizeEntityUrl(undefined), '')
})

test('profile duplication removes managed upload images and managed avatars', () => {
  const { getProfileDuplicationLocationState } = loadTypeScriptModule(
    'Utils/profileDuplication.utils.ts'
  )
  const profile = {
    id: 'profile-1',
    name: 'Sara',
    url: 'sara',
    picture: 'https://project.supabase.co/storage/v1/object/public/nexus-avatars/sara.png',
    about: '<p>Hello</p><img src="/api/uploads/550e8400-e29b-41d4-a716-446655440000/content"><img src="https://example.com/external.png">',
    type: 'social',
    createdAt: 1,
    lastActivity: 2
  }

  const result = getProfileDuplicationLocationState(profile)

  assert.deepEqual(result.duplicateProfile, {
    name: 'Sara',
    url: 'sara-copy',
    picture: '',
    about: '<p>Hello</p><img src="https://example.com/external.png">',
    type: 'social'
  })
  assert.equal(result.duplicateMediaOmitted, true)
})

test('profile duplication preserves unmanaged pictures and reports when no managed media was removed', () => {
  const { getProfileDuplicationLocationState } = loadTypeScriptModule(
    'Utils/profileDuplication.utils.ts'
  )
  const profile = {
    id: 'profile-2',
    name: 'Public profile',
    url: 'public-profile',
    picture: 'https://images.example.com/avatar.png',
    about: '<p>Public text</p>',
    type: 'business',
    createdAt: 1,
    lastActivity: 2
  }

  const result = getProfileDuplicationLocationState(profile)

  assert.equal(result.duplicateProfile.picture, profile.picture)
  assert.equal(result.duplicateProfile.about, profile.about)
  assert.equal(result.duplicateProfile.url, 'public-profile-copy')
  assert.equal(result.duplicateMediaOmitted, false)
})

test('page query keys isolate profile data by viewer and active profile', () => {
  const { queryKeys } = loadTypeScriptModule('Services/Query/queryKeys.ts')

  const first = queryKeys.profilePage('/sara', 'account-a', 'profile-a')
  const otherAccount = queryKeys.profilePage('/sara', 'account-b', 'profile-a')
  const otherProfile = queryKeys.profilePage('/sara', 'account-a', 'profile-b')

  assert.notDeepEqual(first, otherAccount)
  assert.notDeepEqual(first, otherProfile)
})

test('ID-list query keys are deterministic regardless of input order', () => {
  const { queryKeys } = loadTypeScriptModule('Services/Query/queryKeys.ts')

  assert.deepEqual(queryKeys.profiles.byIds(['b', 'a']), queryKeys.profiles.byIds(['a', 'b']))
  assert.deepEqual(queryKeys.communities.byIds(['y', 'x']), queryKeys.communities.byIds(['x', 'y']))
})
