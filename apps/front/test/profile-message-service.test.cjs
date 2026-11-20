const assert = require('node:assert/strict')
const path = require('node:path')
const { Module } = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')

function loadService(api) {
  const filename = path.resolve(
    __dirname,
    '../src/Services/ProfileMessage/profileMessage.service.ts'
  )
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
  assert.deepEqual(errors, [], 'Profile message service should transpile without diagnostics')

  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  const originalLoad = Module._load
  Module._load = function (request, parent, isMain) {
    if (request === '../Http/api') return { api, getApiErrorCode }
    return originalLoad.call(this, request, parent, isMain)
  }
  try {
    loaded._compile(compiled.outputText, filename)
  } finally {
    Module._load = originalLoad
  }
  return loaded.exports
}

function getApiErrorCode(error, fallback) {
  const message = error?.response?.data?.message
  return typeof message === 'string' && message.trim() ? message : fallback
}

function apiFailure(code) {
  return Object.assign(new Error(code), {
    response: { data: { message: code } }
  })
}

test('createProfileMessage preserves known domain and attachment errors', async () => {
  const codes = [
    'INVALID_MESSAGE',
    'ACCOUNT_NOT_FOUND',
    'PROFILE_MESSAGE_FRIENDS_ONLY',
    'PROFILE_TYPE_MISMATCH',
    'PROFILE_NOT_OWNED',
    'PROFILE_NOT_FOUND',
    'INVALID_EDITOR_IMAGE',
    'EDITOR_IMAGE_ALREADY_ATTACHED'
  ]

  for (const code of codes) {
    const { createProfileMessage, ProfileMessageError } = loadService({
      async post() { throw apiFailure(code) }
    })

    await assert.rejects(
      createProfileMessage('sender-1', 'recipient-1', '<p>Hello</p>'),
      error => error instanceof ProfileMessageError && error.code === code
    )
  }
})

test('createProfileMessage uses the generic error for unknown backend and transport failures', async () => {
  for (const error of [
    apiFailure('UNEXPECTED_BACKEND_ERROR'),
    new TypeError('Network request failed')
  ]) {
    const { createProfileMessage, ProfileMessageError } = loadService({
      async post() { throw error }
    })

    await assert.rejects(
      createProfileMessage('sender-1', 'recipient-1', '<p>Hello</p>'),
      caught => caught instanceof ProfileMessageError && caught.code === 'STORAGE_UNAVAILABLE'
    )
  }
})

test('createProfileMessage returns the created message unchanged on success', async () => {
  const message = {
    id: 'message-1',
    fromProfileId: 'sender-1',
    toProfileId: 'recipient-1',
    content: '<p>Hello</p>',
    createdAt: 123,
    isFavorite: false
  }
  const { createProfileMessage } = loadService({
    async post(path, body) {
      assert.equal(path, '/profiles/recipient-1/messages')
      assert.deepEqual(body, { fromProfileId: 'sender-1', content: '<p>Hello</p>' })
      return { data: message }
    }
  })

  assert.deepEqual(
    await createProfileMessage('sender-1', 'recipient-1', '<p>Hello</p>'),
    message
  )
})
