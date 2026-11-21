const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

function loadDeleteProfileMutation(queryClient) {
  const filename = path.resolve(
    __dirname,
    '../src/Hooks/Profile/useDeleteProfileMutation.hook.ts'
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
  assert.deepEqual(errors, [], 'Profile deletion hook should transpile without diagnostics')

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
      return { getCurrentAuthSession: async () => null }
    }
    if (request === '@/Services/Profile') {
      return { deleteUserProfile: async () => undefined }
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
    mutation: loaded.exports.useDeleteProfileMutation(),
    getOptions: () => mutationOptions
  }
}

test('profile deletion invalidates profile, relationship, community membership and dependent page caches', async () => {
  const calls = []
  const queryClient = {
    setQueryData: (...args) => calls.push({ type: 'setQueryData', args }),
    invalidateQueries: async (...args) => calls.push({ type: 'invalidateQueries', args })
  }
  const { getOptions } = loadDeleteProfileMutation(queryClient)
  const options = getOptions()

  await options.onSuccess({
    user: { id: 'account-1' },
    currentProfile: null
  })

  const invalidated = calls
    .filter(call => call.type === 'invalidateQueries')
    .map(call => call.args[0].queryKey)

  for (const expected of [
    ['relationships'],
    ['community-relationships'],
    ['community-members'],
    ['profiles'],
    ['community-members-page'],
    ['profile-page']
  ]) {
    assert.ok(
      invalidated.some(key => key.length === expected.length &&
        key.every((part, index) => part === expected[index])),
      'expected invalidation for ' + expected.join('/')
    )
  }
})
