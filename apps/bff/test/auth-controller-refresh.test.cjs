require('reflect-metadata')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { AuthController } = require('../dist/auth/auth.controller.js')

const user = {
  id: 'account-1',
  email: 'person@example.com',
  profiles: [],
  currentProfile: null
}

function createRequest(cookie = 'nexus_refresh=valid-refresh') {
  return { headers: { cookie } }
}

function createResponse() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
      return this
    }
  }
}

function createController(post) {
  return new AuthController({ axiosRef: { post } })
}

function axiosFailure(status, message) {
  return Object.assign(new Error(message), {
    isAxiosError: true,
    response: {
      status,
      data: { message }
    }
  })
}

test('refresh rotates cookies and returns the authenticated user', async () => {
  const controller = createController(async () => ({
    data: {
      accessToken: 'rotated-access',
      refreshToken: 'rotated-refresh',
      expiresIn: 900,
      user
    }
  }))
  const response = createResponse()

  const result = await controller.refresh(createRequest(), response)

  assert.deepEqual(result, { user, authenticated: true })
  const cookies = response.headers['set-cookie']
  assert.equal(cookies.length, 2)
  assert.match(cookies[0], /nexus_access=rotated-access/)
  assert.match(cookies[1], /nexus_refresh=rotated-refresh/)
})

test('a rejected refresh token clears cookies and returns 401', async () => {
  const controller = createController(async () => {
    throw axiosFailure(401, 'REFRESH_TOKEN_REVOKED')
  })
  const response = createResponse()

  await assert.rejects(
    controller.refresh(createRequest(), response),
    error => error.getStatus?.() === 401 && error.message === 'REFRESH_TOKEN_INVALID'
  )

  const cookies = response.headers['set-cookie']
  assert.equal(cookies.length, 2)
  assert.match(cookies[0], /nexus_access=;.*Max-Age=0/)
  assert.match(cookies[1], /nexus_refresh=;.*Max-Age=0/)
})

test('a transient backend 503 preserves cookies and propagates the upstream error', async () => {
  const controller = createController(async () => {
    throw axiosFailure(503, 'BACKEND_UNAVAILABLE')
  })
  const response = createResponse()

  await assert.rejects(
    controller.refresh(createRequest(), response),
    error => error.getStatus?.() === 503
  )

  assert.equal(response.headers['set-cookie'], undefined)
})

test('a backend network failure becomes 502 without clearing cookies', async () => {
  const controller = createController(async () => {
    throw Object.assign(new Error('connection refused'), { isAxiosError: true })
  })
  const response = createResponse()

  await assert.rejects(
    controller.refresh(createRequest(), response),
    error => error.getStatus?.() === 502 &&
      error.getResponse?.()?.message === 'BACKEND_UNAVAILABLE'
  )

  assert.equal(response.headers['set-cookie'], undefined)
})

test('a malformed refresh cookie is treated as missing and clears stale cookies', async () => {
  let requestCount = 0
  const controller = createController(async () => {
    requestCount += 1
    return { data: {} }
  })
  const response = createResponse()

  await assert.rejects(
    controller.refresh(createRequest('nexus_refresh=%E0%A4%A'), response),
    error => error.getStatus?.() === 401 && error.message === 'REFRESH_TOKEN_MISSING'
  )

  assert.equal(requestCount, 0)
  assert.match(response.headers['set-cookie'][0], /Max-Age=0/)
  assert.match(response.headers['set-cookie'][1], /Max-Age=0/)
})

test('a missing refresh cookie clears stale auth cookies and returns 401', async () => {
  let requestCount = 0
  const controller = createController(async () => {
    requestCount += 1
    return { data: {} }
  })
  const response = createResponse()

  await assert.rejects(
    controller.refresh(createRequest(''), response),
    error => error.getStatus?.() === 401 && error.message === 'REFRESH_TOKEN_MISSING'
  )

  assert.equal(requestCount, 0)
  assert.match(response.headers['set-cookie'][0], /Max-Age=0/)
  assert.match(response.headers['set-cookie'][1], /Max-Age=0/)
})
