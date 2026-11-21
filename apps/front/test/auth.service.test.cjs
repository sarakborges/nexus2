const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const Module = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')

function loadAuthService(api) {
  const filename = path.resolve(__dirname, '../src/Services/Auth/auth.service.ts')
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
  assert.deepEqual(errors, [], 'Auth service should transpile without diagnostics')

  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  const originalLoad = Module._load
  Module._load = function (request, parent, isMain) {
    if (request === '../Http/api') {
      return {
        api,
        getApiErrorCode(error, fallback) {
          const message = error?.response?.data?.message
          if (typeof message === 'string' && message.trim()) return message
          if (Array.isArray(message)) {
            const first = message.find(item => typeof item === 'string' && item.trim())
            if (typeof first === 'string') return first
          }
          return fallback
        }
      }
    }
    if (request === 'axios') {
      return { isAxiosError: error => Boolean(error?.isAxiosError) }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    loaded._compile(compiled.outputText, filename)
  } finally {
    Module._load = originalLoad
  }
  return loaded.exports
}

async function assertSignInError(error, expectedCode) {
  const auth = loadAuthService({
    async post() { throw error }
  })

  await assert.rejects(
    auth.signInUser({ email: 'person@example.com', password: 'secure-password' }),
    received => received instanceof auth.AuthError && received.code === expectedCode
  )
}

test('sign-in maps backend 5xx failures to a generic network error, not invalid credentials', async () => {
  await assertSignInError(Object.assign(new Error('Backend unavailable'), {
    isAxiosError: true,
    response: { status: 503, data: { message: 'BACKEND_UNAVAILABLE' } }
  }), 'NETWORK_ERROR')
})

test('sign-in maps transport failures without an HTTP response to a network error', async () => {
  await assertSignInError(Object.assign(new Error('Network Error'), {
    isAxiosError: true
  }), 'NETWORK_ERROR')
})

test('sign-in preserves explicit invalid-credentials and rate-limit responses', async () => {
  await assertSignInError(Object.assign(new Error('Unauthorized'), {
    isAxiosError: true,
    response: { status: 401, data: { message: 'INVALID_CREDENTIALS' } }
  }), 'INVALID_CREDENTIALS')

  await assertSignInError(Object.assign(new Error('Too many requests'), {
    isAxiosError: true,
    response: { status: 429, data: { message: 'AUTH_RATE_LIMIT_EXCEEDED' } }
  }), 'AUTH_RATE_LIMIT_EXCEEDED')
})
