require('reflect-metadata')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { ApiProxyController } = require('../dist/proxy/api-proxy.controller.js')

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
      return this
    },
    status(code) {
      this.statusCode = code
      return this
    },
    send(value) {
      this.body = value
      return this
    },
    json(value) {
      this.body = value
      return this
    }
  }
}

test('successful account deletion clears both browser authentication cookies', async () => {
  const controller = new ApiProxyController({
    axiosRef: {
      async request(config) {
        assert.equal(config.url.endsWith('/auth/account'), true)
        assert.equal(config.method, 'DELETE')
        assert.equal(config.headers.Authorization, 'Bearer access-token')
        return { status: 200, headers: {}, data: { success: true } }
      }
    }
  })
  const response = createResponse()

  await controller.proxy({
    path: '/api/auth/account',
    method: 'DELETE',
    headers: { cookie: 'nexus_access=access-token; nexus_refresh=refresh-token', origin: 'http://localhost:5173', host: 'localhost:5173', 'x-forwarded-proto': 'http' },
    query: {},
    body: undefined
  }, response)

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, { success: true })
  const cookies = response.headers['set-cookie'].join(';')
  assert.match(cookies, /nexus_access=;[^,]*Max-Age=0/)
  assert.match(cookies, /nexus_refresh=;[^,]*Max-Age=0/)
})

test('failed account deletion does not clear the current session', async () => {
  const controller = new ApiProxyController({
    axiosRef: {
      async request() {
        return { status: 500, headers: {}, data: { message: 'DELETE_FAILED' } }
      }
    }
  })
  const response = createResponse()

  await controller.proxy({
    path: '/api/auth/account',
    method: 'DELETE',
    headers: { cookie: 'nexus_access=access-token; nexus_refresh=refresh-token', origin: 'http://localhost:5173', host: 'localhost:5173', 'x-forwarded-proto': 'http' },
    query: {},
    body: undefined
  }, response)

  assert.equal(response.statusCode, 500)
  assert.equal(response.headers['set-cookie'], undefined)
})
