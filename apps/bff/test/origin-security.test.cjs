require('reflect-metadata')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { ForbiddenException } = require('@nestjs/common')
const { assertSameOrigin } = require('../dist/origin.util.js')
const { AuthController } = require('../dist/auth/auth.controller.js')
const { ApiProxyController } = require('../dist/proxy/api-proxy.controller.js')

function withFrontendOrigin(value, callback) {
  const previous = process.env.FRONTEND_ORIGIN
  if (value === undefined) delete process.env.FRONTEND_ORIGIN
  else process.env.FRONTEND_ORIGIN = value
  const restore = () => {
    if (previous === undefined) delete process.env.FRONTEND_ORIGIN
    else process.env.FRONTEND_ORIGIN = previous
  }
  try {
    const result = callback()
    if (result && typeof result.then === 'function') return result.finally(restore)
    restore()
    return result
  } catch (error) {
    restore()
    throw error
  }
}

function request(method, origin, headers = {}) {
  return {
    method,
    protocol: 'https',
    headers: {
      host: 'nexus.example.com',
      'x-forwarded-proto': 'https',
      ...(origin === undefined ? {} : { origin }),
      ...headers
    }
  }
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this },
    json(value) { this.body = value; return this },
    send(value) { this.body = value; return this },
    setHeader() { return this }
  }
}

test('allows unsafe requests from the configured frontend origin', () =>
  withFrontendOrigin('https://nexus.example.com', () => {
    assert.doesNotThrow(() => assertSameOrigin(request('POST', 'https://nexus.example.com')))
  })
)

test('allows same-origin production requests using the forwarded public protocol and Host', () =>
  withFrontendOrigin(undefined, () => {
    assert.doesNotThrow(() => assertSameOrigin(request('DELETE', 'https://nexus.example.com')))
  })
)

test('rejects a same-site sibling origin even when it shares the parent domain', () =>
  withFrontendOrigin(undefined, () => {
    assert.throws(
      () => assertSameOrigin(request('POST', 'https://attacker.example.com')),
      error => error instanceof ForbiddenException &&
        error.getStatus() === 403 &&
        error.message === 'CSRF_ORIGIN_INVALID'
    )
  })
)

test('rejects unsafe browser requests without an Origin header', () =>
  withFrontendOrigin(undefined, () => {
    assert.throws(
      () => assertSameOrigin(request('POST', undefined)),
      error => error instanceof ForbiddenException && error.getStatus() === 403
    )
  })
)

test('safe reads and CORS preflights do not require Origin validation', () =>
  withFrontendOrigin(undefined, () => {
    assert.doesNotThrow(() => assertSameOrigin(request('GET', undefined)))
    assert.doesNotThrow(() => assertSameOrigin(request('OPTIONS', undefined)))
  })
)

test('API proxy rejects a foreign mutation before forwarding it upstream', () =>
  withFrontendOrigin('https://nexus.example.com', () => {
    let forwarded = 0
    const controller = new ApiProxyController({
      axiosRef: {
        async request() {
          forwarded += 1
          return { status: 200, headers: {}, data: { success: true } }
        }
      }
    })

    return controller.proxy({
      path: '/api/relationships/remove',
      method: 'POST',
      headers: {
        origin: 'https://attacker.example.com',
        host: 'nexus.example.com',
        cookie: 'nexus_access=access-token'
      },
      query: {},
      body: { sourceProfileId: 'profile-a', targetProfileId: 'profile-b' }
    }, createResponse()).then(
      () => { throw new Error('Expected foreign origin to be rejected') },
      error => {
        assert.equal(error.getStatus(), 403)
        assert.equal(error.message, 'CSRF_ORIGIN_INVALID')
        assert.equal(forwarded, 0)
      }
    )
  })
)

test('BFF sign-in rejects a foreign Origin before sending credentials to the backend', () =>
  withFrontendOrigin('https://nexus.example.com', () => {
    let forwarded = 0
    const controller = new AuthController({
      axiosRef: {
        async post() {
          forwarded += 1
          return { data: {} }
        }
      }
    })

    return controller.signIn(
      { email: 'person@example.com', password: 'password' },
      request('POST', 'https://attacker.example.com'),
      createResponse()
    ).then(
      () => { throw new Error('Expected foreign origin to be rejected') },
      error => {
        assert.equal(error.getStatus(), 403)
        assert.equal(error.message, 'CSRF_ORIGIN_INVALID')
        assert.equal(forwarded, 0)
      }
    )
  })
)
