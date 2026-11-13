require('reflect-metadata')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { ApiProxyController } = require('../dist/proxy/api-proxy.controller.js')

function createRequest() {
  return {
    path: '/api/profile-page',
    method: 'GET',
    headers: { cookie: 'nexus_access=old-access; nexus_refresh=old-refresh' },
    query: {},
    body: undefined
  }
}

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

test('parallel requests share one refresh rotation and each receive the new cookies', async () => {
  let refreshCalls = 0
  let apiCalls = 0
  const http = {
    axiosRef: {
      async request(config) {
        apiCalls += 1
        await new Promise(resolve => setTimeout(resolve, 0))
        if (config.headers.Authorization === 'Bearer old-access') {
          return { status: 401, headers: {}, data: { message: 'ACCESS_TOKEN_INVALID_OR_EXPIRED' } }
        }
        return { status: 200, headers: {}, data: { success: true } }
      },
      async post(_url, body) {
        refreshCalls += 1
        assert.equal(body.refreshToken, 'old-refresh')
        await new Promise(resolve => setTimeout(resolve, 5))
        return {
          data: {
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
            expiresIn: 900
          }
        }
      }
    }
  }
  const controller = new ApiProxyController(http)
  const firstResponse = createResponse()
  const secondResponse = createResponse()

  await Promise.all([
    controller.proxy(createRequest(), firstResponse),
    controller.proxy(createRequest(), secondResponse)
  ])

  assert.equal(refreshCalls, 1)
  assert.equal(apiCalls, 4)
  assert.equal(firstResponse.statusCode, 200)
  assert.equal(secondResponse.statusCode, 200)
  for (const response of [firstResponse, secondResponse]) {
    const cookies = response.headers['set-cookie'].join(';')
    assert.match(cookies, /nexus_access=new-access/)
    assert.match(cookies, /nexus_refresh=new-refresh/)
  }
})

test('an automatic refresh failure does not clear cookies on a potentially concurrent response', async () => {
  const http = {
    axiosRef: {
      async request() {
        return { status: 401, headers: {}, data: { message: 'ACCESS_TOKEN_INVALID_OR_EXPIRED' } }
      },
      async post() {
        throw new Error('REFRESH_TOKEN_REVOKED')
      }
    }
  }
  const controller = new ApiProxyController(http)
  const response = createResponse()

  await controller.proxy(createRequest(), response)

  assert.equal(response.statusCode, 401)
  assert.equal(response.headers['set-cookie'], undefined)
})
