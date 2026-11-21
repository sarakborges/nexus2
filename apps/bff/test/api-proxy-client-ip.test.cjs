require('reflect-metadata')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { ApiProxyController } = require('../dist/proxy/api-proxy.controller.js')

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this },
    send(value) { this.body = value; return this },
    json(value) { this.body = value; return this },
    setHeader() { return this }
  }
}

test('API proxy forwards a server-derived client IP only to the Realtime verification route', async () => {
  const previousOrigin = process.env.FRONTEND_ORIGIN
  process.env.FRONTEND_ORIGIN = 'https://nexus.example.com'
  try {
    let forwardedConfig
    const controller = new ApiProxyController({
      axiosRef: {
        async request(config) {
          forwardedConfig = config
          return { status: 200, headers: {}, data: { valid: true } }
        }
      }
    })
    const request = {
      path: '/api/realtime/verify',
      method: 'POST',
      protocol: 'https',
      headers: {
        origin: 'https://nexus.example.com',
        host: 'nexus.example.com',
        'x-forwarded-proto': 'https',
        'x-vercel-forwarded-for': '203.0.113.42',
        'x-forwarded-for': '198.51.100.10',
        'x-nexus-client-ip': '192.0.2.55'
      },
      query: {},
      body: {
        topicId: '550e8400-e29b-41d4-a716-446655440000',
        changedAt: 1_800_000_000_000,
        signature: 'A'.repeat(43)
      }
    }
    const response = createResponse()

    await controller.proxy(request, response)

    assert.equal(response.statusCode, 200)
    assert.equal(forwardedConfig.headers['x-nexus-client-ip'], '203.0.113.42')
    assert.equal(forwardedConfig.headers['x-nexus-client-ip'], request.headers['x-vercel-forwarded-for'])
  } finally {
    if (previousOrigin === undefined) delete process.env.FRONTEND_ORIGIN
    else process.env.FRONTEND_ORIGIN = previousOrigin
  }
})

test('API proxy does not add client IP metadata to unrelated routes', async () => {
  const controller = new ApiProxyController({
    axiosRef: {
      async request(config) {
        assert.equal(config.headers['x-nexus-client-ip'], undefined)
        return { status: 200, headers: {}, data: { ok: true } }
      }
    }
  })
  await controller.proxy({
    path: '/api/realtime/config',
    method: 'GET',
    headers: {},
    query: {},
    body: undefined
  }, createResponse())
})

test('API proxy forwards private community avatar images as binary and preserves no-store headers', async () => {
  let forwardedConfig
  const forwardedHeaders = {}
  const body = Buffer.from([137, 80, 78, 71])
  const controller = new ApiProxyController({
    axiosRef: {
      async request(config) {
        forwardedConfig = config
        return {
          status: 200,
          headers: {
            'content-type': 'image/png',
            'content-length': String(body.length),
            'cache-control': 'private, no-store, max-age=0',
            'x-content-type-options': 'nosniff'
          },
          data: body
        }
      }
    }
  })
  const response = createResponse()
  response.setHeader = function (name, value) { forwardedHeaders[name] = value; return this }
  await controller.proxy({
    path: '/api/uploads/community-avatars/123e4567-e89b-42d3-a456-426614174000/content',
    method: 'GET',
    headers: {},
    query: {},
    body: undefined
  }, response)

  assert.equal(forwardedConfig.responseType, 'arraybuffer')
  assert.deepEqual(response.body, body)
  assert.equal(forwardedHeaders['cache-control'], 'private, no-store, max-age=0')
  assert.equal(forwardedHeaders['x-content-type-options'], 'nosniff')
})
