const test = require('node:test')
const assert = require('node:assert/strict')
const { JwtAccessGuard, OptionalJwtAccessGuard } = require('../dist/api/auth/jwt-access.guard.js')

function contextFor(request) {
  return { switchToHttp: () => ({ getRequest: () => request }) }
}

function jwtReturning(payload) {
  return {
    async verifyAsync(token) {
      assert.equal(token, 'signed-token')
      if (payload instanceof Error) throw payload
      return payload
    }
  }
}

function unauthorized(error, message) {
  return error?.getStatus?.() === 401 && error.message === message
}

test('access guard rejects requests without a bearer token', async () => {
  const guard = new JwtAccessGuard(jwtReturning({ sub: 'user', email: 'user@example.com', type: 'access' }))
  await assert.rejects(
    guard.canActivate(contextFor({ headers: {} })),
    error => unauthorized(error, 'ACCESS_TOKEN_MISSING')
  )
})

test('access guard rejects unsupported authorization schemes', async () => {
  const guard = new JwtAccessGuard(jwtReturning({ sub: 'user', email: 'user@example.com', type: 'access' }))
  await assert.rejects(
    guard.canActivate(contextFor({ headers: { authorization: 'Basic invalid' } })),
    error => unauthorized(error, 'ACCESS_TOKEN_INVALID_OR_EXPIRED')
  )
})

test('access guard rejects refresh tokens presented as access tokens', async () => {
  const guard = new JwtAccessGuard(jwtReturning({ sub: 'user', email: 'user@example.com', type: 'refresh', jti: 'refresh-id' }))
  await assert.rejects(
    guard.canActivate(contextFor({ headers: { authorization: 'Bearer signed-token' } })),
    error => unauthorized(error, 'ACCESS_TOKEN_INVALID_OR_EXPIRED')
  )
})

test('access guard rejects invalid and expired tokens', async () => {
  const guard = new JwtAccessGuard(jwtReturning(new Error('TOKEN_EXPIRED')))
  await assert.rejects(
    guard.canActivate(contextFor({ headers: { authorization: 'Bearer signed-token' } })),
    error => unauthorized(error, 'ACCESS_TOKEN_INVALID_OR_EXPIRED')
  )
})

test('access guard attaches only the authenticated public identity', async () => {
  const guard = new JwtAccessGuard(jwtReturning({
    sub: 'user-1',
    email: 'user@example.com',
    type: 'access',
    jti: 'must-not-leak'
  }))
  const request = { headers: { authorization: 'Bearer signed-token' } }

  assert.equal(await guard.canActivate(contextFor(request)), true)
  assert.deepEqual(request.user, {
    id: 'user-1',
    email: 'user@example.com',
    profiles: [],
    currentProfile: null
  })
  assert.equal(Object.hasOwn(request.user, 'jti'), false)
})

test('optional guard permits anonymous requests without an authorization header', async () => {
  const guard = new OptionalJwtAccessGuard(jwtReturning(new Error('SHOULD_NOT_VERIFY')))
  const request = { headers: {} }

  assert.equal(await guard.canActivate(contextFor(request)), true)
  assert.equal(request.user, undefined)
})

test('optional guard does not silently downgrade an invalid supplied token to anonymous', async () => {
  const guard = new OptionalJwtAccessGuard(jwtReturning(new Error('TOKEN_EXPIRED')))
  await assert.rejects(
    guard.canActivate(contextFor({ headers: { authorization: 'Bearer signed-token' } })),
    error => unauthorized(error, 'ACCESS_TOKEN_INVALID_OR_EXPIRED')
  )
})
