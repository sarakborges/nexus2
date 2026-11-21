const assert = require('node:assert/strict')
const { test } = require('node:test')
const { ServiceUnavailableException } = require('@nestjs/common')
const { SupabaseRepositoryClient } = require('../dist/storage/supabase-repository.client.js')

class TestRepository extends SupabaseRepositoryClient {
  constructor() {
    super('https://project.example.supabase.co', 'publishable-key', 'api-secret')
  }

  request(init = {}) {
    return this.fetchWithTimeout(
      'https://project.example.supabase.co/rest/v1/accounts',
      init
    )
  }
}

test('Supabase repository requests receive a 25-second abort deadline', async t => {
  const originalFetch = global.fetch
  const originalTimeout = AbortSignal.timeout
  const controller = new AbortController()
  let timeoutMs
  let passedInit

  AbortSignal.timeout = milliseconds => {
    timeoutMs = milliseconds
    return controller.signal
  }
  global.fetch = async (_input, init) => {
    passedInit = init
    return new Response('[]', { status: 200 })
  }
  t.after(() => {
    global.fetch = originalFetch
    AbortSignal.timeout = originalTimeout
  })

  const response = await new TestRepository().request()

  assert.equal(response.status, 200)
  assert.equal(timeoutMs, 25_000)
  assert.equal(passedInit.signal, controller.signal)
})

test('Supabase repository timeout failures become service unavailable', async t => {
  const originalFetch = global.fetch
  const originalTimeout = AbortSignal.timeout
  const controller = new AbortController()
  controller.abort(new Error('simulated database request timeout'))

  AbortSignal.timeout = () => controller.signal
  global.fetch = async (_input, init) => {
    throw init.signal.reason
  }
  t.after(() => {
    global.fetch = originalFetch
    AbortSignal.timeout = originalTimeout
  })

  await assert.rejects(
    new TestRepository().request(),
    error => error instanceof ServiceUnavailableException &&
      error.getStatus() === 503 &&
      error.message === 'SUPABASE_REQUEST_TIMEOUT'
  )
})

test('Supabase repository requests preserve explicit caller abort signals', async t => {
  const originalFetch = global.fetch
  const originalTimeout = AbortSignal.timeout
  const controller = new AbortController()
  let passedInit

  AbortSignal.timeout = () => {
    throw new Error('default timeout should not replace an explicit signal')
  }
  global.fetch = async (_input, init) => {
    passedInit = init
    return new Response('[]', { status: 200 })
  }
  t.after(() => {
    global.fetch = originalFetch
    AbortSignal.timeout = originalTimeout
  })

  await new TestRepository().request({ signal: controller.signal })

  assert.equal(passedInit.signal, controller.signal)
})

test('Supabase response body timeouts become service unavailable after headers arrive', async t => {
  const originalFetch = global.fetch
  const originalTimeout = AbortSignal.timeout
  const controller = new AbortController()
  AbortSignal.timeout = () => controller.signal
  global.fetch = async () => new Response(new ReadableStream({
    start() {
      controller.abort(new Error('simulated response body timeout'))
    }
  }), { status: 200 })
  t.after(() => {
    global.fetch = originalFetch
    AbortSignal.timeout = originalTimeout
  })

  const response = await new TestRepository().request()
  await assert.rejects(
    response.json(),
    error => error instanceof ServiceUnavailableException &&
      error.getStatus() === 503 &&
      error.message === 'SUPABASE_REQUEST_TIMEOUT'
  )
})
