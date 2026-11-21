const assert = require('node:assert/strict')
const { test } = require('node:test')
const { UploadsStorageService } = require('../dist/api/uploads/uploads.storage.service.js')

function createService() {
  return new UploadsStorageService({
    get(key) {
      return {
        SUPABASE_URL: 'https://project.example.supabase.co/',
        SUPABASE_STORAGE_SECRET_KEY: 'server-storage-secret'
      }[key]
    }
  })
}

test('Storage requests receive a default 15-second abort deadline', async t => {
  const originalFetch = global.fetch
  const originalTimeout = AbortSignal.timeout
  const controller = new AbortController()
  let requestedTimeout
  let requestUrl
  let requestInit

  AbortSignal.timeout = milliseconds => {
    requestedTimeout = milliseconds
    return controller.signal
  }
  global.fetch = async (url, init) => {
    requestUrl = String(url)
    requestInit = init
    return new Response('{}', { status: 200 })
  }
  t.after(() => {
    global.fetch = originalFetch
    AbortSignal.timeout = originalTimeout
  })

  const service = createService()
  const response = await service.request('/object/nexus-editor-images/image.png', {
    method: 'GET'
  })

  assert.equal(response.status, 200)
  assert.equal(requestUrl, 'https://project.example.supabase.co/storage/v1/object/nexus-editor-images/image.png')
  assert.equal(requestedTimeout, 15_000)
  assert.equal(requestInit.signal, controller.signal)
  assert.equal(requestInit.headers.get('apikey'), 'server-storage-secret')
  assert.equal(requestInit.headers.has('authorization'), false)
})

test('Storage requests preserve an explicitly supplied abort signal', async t => {
  const originalFetch = global.fetch
  const originalTimeout = AbortSignal.timeout
  const controller = new AbortController()
  let requestInit

  AbortSignal.timeout = () => {
    throw new Error('default timeout must not replace a caller signal')
  }
  global.fetch = async (_url, init) => {
    requestInit = init
    return new Response('{}', { status: 200 })
  }
  t.after(() => {
    global.fetch = originalFetch
    AbortSignal.timeout = originalTimeout
  })

  await createService().request('/object/nexus-editor-images/image.png', {
    method: 'GET',
    signal: controller.signal
  })

  assert.equal(requestInit.signal, controller.signal)
})

test('Storage transport failures are normalized as service unavailable', async t => {
  const originalFetch = global.fetch
  global.fetch = async () => {
    throw new Error('simulated network failure')
  }
  t.after(() => { global.fetch = originalFetch })

  await assert.rejects(
    createService().request('/object/nexus-editor-images/image.png', {
      method: 'GET'
    }),
    error => error.getStatus() === 503 &&
      error.message === 'UPLOAD_STORAGE_REQUEST_FAILED'
  )
})
