const assert = require('node:assert/strict')
const path = require('node:path')
const { Module } = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')

function loadTypeScriptModule(relativePath, stubs = {}) {
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
  assert.deepEqual(errors, [], 'TypeScript module should transpile without diagnostics')

  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))

  const originalLoad = Module._load
  Module._load = function (request, parent, isMain) {
    if (Object.hasOwn(stubs, request)) return stubs[request]
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    loaded._compile(compiled.outputText, filename)
  } finally {
    Module._load = originalLoad
  }

  return loaded.exports
}

function withFetch(t, implementation) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = implementation
  t.after(() => {
    globalThis.fetch = originalFetch
  })
}

test('uploadFile completes presign, direct Storage transfer and backend completion', async t => {
  const calls = []
  const signedUrl = 'https://project.example.supabase.co/storage/v1/upload/sign/nexus-avatars/path?token=signed'
  const completed = { id: 'upload-1', url: 'https://project.example/avatar.png' }
  const api = {
    async post(endpoint, body) {
      calls.push({ method: 'POST', endpoint, body })
      if (endpoint === '/uploads/presign') {
        return { data: { id: 'upload-1', uploadUrl: signedUrl } }
      }
      if (endpoint === '/uploads/upload-1/complete') return { data: completed }
      throw new Error('Unexpected POST ' + endpoint)
    },
    async delete(endpoint) {
      calls.push({ method: 'DELETE', endpoint })
    }
  }
  const { uploadFile } = loadTypeScriptModule('Services/Uploads/uploads.service.ts', {
    '../Http/api': { api }
  })
  const file = new File([new Uint8Array([137, 80, 78, 71])], 'avatar.png', {
    type: 'image/png'
  })

  withFetch(t, async (url, init) => {
    assert.equal(url, signedUrl)
    assert.equal(init.method, 'PUT')
    assert.ok(init.body instanceof FormData)
    assert.equal(init.body.get('cacheControl'), '3600')
    assert.equal(init.body.get('').name, 'avatar.png')
    return { ok: true }
  })

  const result = await uploadFile(file, 'community-avatar', 'community-1', 'profile-1')

  assert.deepEqual(result, completed)
  assert.deepEqual(calls.map(call => [call.method, call.endpoint]), [
    ['POST', '/uploads/presign'],
    ['POST', '/uploads/upload-1/complete']
  ])
  assert.deepEqual(calls[0].body, {
    purpose: 'community-avatar',
    contentType: 'image/png',
    size: file.size,
    targetId: 'community-1',
    actorProfileId: 'profile-1'
  })
})

test('uploadFile rejects unsupported or oversized files before requesting a signed URL', async () => {
  const calls = []
  const api = {
    async post(...args) { calls.push(args); throw new Error('Should not request a signed URL') },
    async delete(...args) { calls.push(args) }
  }
  const { uploadFile } = loadTypeScriptModule('Services/Uploads/uploads.service.ts', {
    '../Http/api': { api }
  })

  await assert.rejects(
    uploadFile({ type: 'image/svg+xml', size: 128 }, 'editor-image'),
    error => error.message === 'INVALID_UPLOAD_TYPE'
  )
  await assert.rejects(
    uploadFile({ type: 'image/png', size: 10 * 1024 * 1024 + 1 }, 'editor-image'),
    error => error.message === 'INVALID_UPLOAD_SIZE'
  )
  await assert.rejects(
    uploadFile({ type: 'image/png', size: 0 }, 'profile-avatar'),
    error => error.message === 'INVALID_UPLOAD_SIZE'
  )
  assert.deepEqual(calls, [])
})

test('uploadFile removes pending metadata when backend completion fails', async t => {
  const calls = []
  const api = {
    async post(endpoint) {
      calls.push(['POST', endpoint])
      if (endpoint === '/uploads/presign') {
        return {
          data: {
            id: 'upload-2',
            uploadUrl: 'https://project.example.supabase.co/signed-upload'
          }
        }
      }
      throw new Error('UPLOAD_COMPLETION_FAILED')
    },
    async delete(endpoint) {
      calls.push(['DELETE', endpoint])
    }
  }
  const { uploadFile } = loadTypeScriptModule('Services/Uploads/uploads.service.ts', {
    '../Http/api': { api }
  })
  const file = new File(['png'], 'image.png', { type: 'image/png' })

  withFetch(t, async () => ({ ok: true }))

  await assert.rejects(
    uploadFile(file, 'editor-image'),
    error => error.message === 'UPLOAD_COMPLETION_FAILED'
  )
  assert.deepEqual(calls, [
    ['POST', '/uploads/presign'],
    ['POST', '/uploads/upload-2/complete'],
    ['DELETE', '/uploads/upload-2']
  ])
})

test('failed avatar assignment schedules cleanup of the completed upload and preserves the original error', async () => {
  const originalError = new Error('PROFILE_NOT_OWNED')
  const removed = []
  const services = {
    async uploadFile() {
      return { id: 'upload-3', url: '/api/uploads/upload-3/content' }
    },
    async deleteUploadedFile(id) {
      removed.push(id)
    },
    async updateProfileAvatar() {
      throw originalError
    },
    async updateCommunityAvatar() {
      throw new Error('Unexpected community avatar update')
    }
  }
  const { useAvatarMutation } = loadTypeScriptModule(
    'Hooks/Uploads/useAvatarMutation.hook.ts',
    {
      '@tanstack/react-query': { useMutation: options => options },
      '@/Services/Uploads': services
    }
  )

  const mutation = useAvatarMutation()
  await assert.rejects(
    mutation.mutationFn({
      action: 'upload',
      file: {},
      purpose: 'profile-avatar',
      targetId: 'profile-1',
      pendingUploadId: null
    }),
    error => error === originalError
  )
  assert.deepEqual(removed, ['upload-3'])
})
