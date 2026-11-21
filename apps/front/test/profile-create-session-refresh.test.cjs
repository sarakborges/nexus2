const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

function loadMutation(queryClient, services) {
  const filename = path.resolve(
    __dirname,
    '../src/Hooks/Profile/useCreateProfileMutation.hook.ts'
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
  assert.deepEqual(errors, [], 'Profile creation hook should transpile without diagnostics')

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
      return { getCurrentAuthSession: services.getCurrentAuthSession }
    }
    if (request === '@/Services/Profile') {
      return { createUserProfile: services.createUserProfile }
    }
    if (request === '@/Services/Query/queryKeys') {
      return {
        queryKeys: {
          auth: { session: ['auth', 'session'] },
          profiles: { byUrl: url => ['profiles', 'by-url', url] }
        }
      }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    loaded._compile(compiled.outputText, filename)
  } finally {
    Module._load = originalLoad
  }

  return {
    mutation: loaded.exports.useCreateProfileMutation(),
    getOptions: () => mutationOptions
  }
}

test('profile creation remains successful when post-write auth session refresh is unavailable', async () => {
  const previousSession = {
    user: {
      id: 'account-1',
      email: 'person@example.com',
      profiles: [],
      currentProfile: null
    },
    currentProfile: null,
    currentProfileSettings: null,
    suggestedCommunities: [],
    activities: [],
    activityCursor: null,
    hasMoreActivities: false,
    authenticatedAt: 100
  }
  const profile = {
    id: 'profile-1',
    name: 'New profile',
    url: 'new-profile',
    picture: '',
    about: '',
    type: 'social',
    createdAt: 200,
    lastActivity: 200
  }
  const result = {
    profile,
    user: {
      id: 'account-1',
      email: 'person@example.com',
      profiles: ['profile-1'],
      currentProfile: 'profile-1'
    }
  }
  const calls = []
  const queryClient = {
    getQueryData: () => previousSession,
    setQueryData(key, updater) {
      const value = typeof updater === 'function' ? updater(this.getQueryData(key)) : updater
      calls.push({ type: 'setQueryData', key, value })
    },
    invalidateQueries: async ({ queryKey }) => {
      calls.push({ type: 'invalidateQueries', key: queryKey })
    }
  }
  let refreshCalls = 0
  const { getOptions } = loadMutation(queryClient, {
    async createUserProfile() { return result },
    async getCurrentAuthSession() {
      refreshCalls += 1
      throw new Error('temporary /auth/me outage')
    }
  })

  const options = getOptions()
  const created = await options.mutationFn({
    name: 'New profile',
    picture: '',
    about: '',
    type: 'social'
  })

  assert.equal(refreshCalls, 1)
  assert.equal(created, result)
  const sessionUpdate = calls.find(call =>
    call.type === 'setQueryData' &&
    call.key[0] === 'auth' &&
    call.key[1] === 'session'
  )
  assert.equal(sessionUpdate.value.user.currentProfile, 'profile-1')
  assert.deepEqual(sessionUpdate.value.user.profiles, ['profile-1'])
  assert.deepEqual(sessionUpdate.value.currentProfile, profile)

  await options.onSuccess(result)

  assert.ok(calls.some(call =>
    call.type === 'invalidateQueries' &&
    call.key[0] === 'auth' &&
    call.key[1] === 'session'
  ))
})
