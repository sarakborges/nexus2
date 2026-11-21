const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

function loadMutation(queryClient, services) {
  const filename = path.resolve(
    __dirname,
    '../src/Hooks/Auth/useSetCurrentProfileMutation.hook.ts'
  )
  const source = fs.readFileSync(filename, 'utf8')
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
  assert.deepEqual(errors, [], 'Profile selection hook should transpile without diagnostics')

  let mutationOptions
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  const originalLoad = Module._load

  Module._load = function (request, parent, isMain) {
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => queryClient,
        useMutation: options => {
          mutationOptions = options
          return options
        }
      }
    }
    if (request === '@/Services/Auth') {
      return {
        getCurrentAuthSession: services.getCurrentAuthSession,
        setCurrentProfile: services.setCurrentProfile
      }
    }
    if (request === '@/Services/Query/queryKeys') {
      return { queryKeys: { auth: { session: ['auth', 'session'] } } }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    loaded._compile(compiled.outputText, filename)
  } finally {
    Module._load = originalLoad
  }

  return {
    mutation: loaded.exports.useSetCurrentProfileMutation(),
    getOptions: () => mutationOptions
  }
}

test('profile selection succeeds with the cached target profile while auth session refresh is unavailable', async () => {
  const profile = {
    id: 'profile-2',
    name: 'Second profile',
    url: 'second-profile',
    picture: '',
    about: '',
    type: 'social',
    createdAt: 200,
    lastActivity: 200
  }
  const previousSession = {
    user: {
      id: 'account-1',
      email: 'person@example.com',
      profiles: ['profile-1', 'profile-2'],
      currentProfile: 'profile-1'
    },
    currentProfile: {
      id: 'profile-1',
      name: 'First profile'
    },
    currentProfileSettings: { messageAudience: 'friends' },
    suggestedCommunities: [{ id: 'community-old' }],
    activities: [{ id: 'activity-old' }],
    activityCursor: { id: 'activity-old', updatedAt: 100 },
    hasMoreActivities: true,
    authenticatedAt: 100
  }
  const user = {
    ...previousSession.user,
    currentProfile: 'profile-2'
  }
  const calls = []
  const queryClient = {
    getQueryData: () => previousSession,
    getQueriesData: () => [[
      ['profiles', 'owned', 'account-1', 1, 20],
      { items: [profile] }
    ]],
    setQueryData(key, updater) {
      const value = typeof updater === 'function' ? updater(previousSession) : updater
      calls.push({ type: 'setQueryData', key, value })
    },
    invalidateQueries: async ({ queryKey }) => {
      calls.push({ type: 'invalidateQueries', key: queryKey })
    }
  }
  let refreshCalls = 0
  const { getOptions } = loadMutation(queryClient, {
    async setCurrentProfile(profileId) {
      assert.equal(profileId, 'profile-2')
      return user
    },
    async getCurrentAuthSession() {
      refreshCalls += 1
      throw new Error('temporary /auth/me outage')
    }
  })
  const options = getOptions()

  await assert.doesNotReject(options.mutationFn('profile-2'))

  assert.equal(refreshCalls, 1)
  const sessionUpdate = calls.find(call =>
    call.type === 'setQueryData' && call.key[0] === 'auth'
  )
  assert.equal(sessionUpdate.value.user.currentProfile, 'profile-2')
  assert.deepEqual(sessionUpdate.value.currentProfile, profile)
  assert.equal(sessionUpdate.value.currentProfileSettings, null)
  assert.deepEqual(sessionUpdate.value.suggestedCommunities, [])
  assert.deepEqual(sessionUpdate.value.activities, [])
  assert.equal(sessionUpdate.value.activityCursor, null)
  assert.equal(sessionUpdate.value.hasMoreActivities, false)

  await options.onSuccess()
  assert.ok(calls.some(call =>
    call.type === 'invalidateQueries' &&
    call.key[0] === 'auth' &&
    call.key[1] === 'session'
  ))
})

test('profile selection does not report success without a cached target profile when auth refresh fails', async () => {
  const previousSession = {
    user: {
      id: 'account-1',
      email: 'person@example.com',
      profiles: ['profile-1', 'profile-2'],
      currentProfile: 'profile-1'
    },
    currentProfile: { id: 'profile-1' },
    currentProfileSettings: null,
    suggestedCommunities: [],
    activities: [],
    activityCursor: null,
    hasMoreActivities: false,
    authenticatedAt: 100
  }
  const queryClient = {
    getQueryData: () => previousSession,
    getQueriesData: () => [],
    setQueryData() {},
    invalidateQueries: async () => undefined
  }
  const { getOptions } = loadMutation(queryClient, {
    async setCurrentProfile() {
      return { ...previousSession.user, currentProfile: 'profile-2' }
    },
    async getCurrentAuthSession() {
      throw new Error('temporary /auth/me outage')
    }
  })

  await assert.rejects(
    getOptions().mutationFn('profile-2'),
    error => error.message === 'CURRENT_PROFILE_UPDATE_FAILED'
  )
})
