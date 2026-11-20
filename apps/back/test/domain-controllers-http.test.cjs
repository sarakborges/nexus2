require('reflect-metadata')

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { Module, ValidationPipe } = require('@nestjs/common')
const { NestFactory } = require('@nestjs/core')
const { DomainService } = require('../dist/api/domain/domain.service.js')
const { ProfilesController } = require('../dist/api/domain/profiles.controller.js')
const { RelationshipsController } = require('../dist/api/domain/relationships.controller.js')
const { ProfilePageService } = require('../dist/api/domain/profile-page.service.js')
const { ProfileDirectoryPageService } = require('../dist/api/domain/profile-directory-page.service.js')
const { ProfileEditPageService } = require('../dist/api/domain/profile-edit-page.service.js')
const { ProfileSettingsService } = require('../dist/api/domain/profile-settings.service.js')

async function createHttpApp(domain) {
  class ControllersHttpTestModule {}

  Module({
    controllers: [ProfilesController, RelationshipsController],
    providers: [
      { provide: DomainService, useValue: domain },
      { provide: ProfilePageService, useValue: {} },
      { provide: ProfileDirectoryPageService, useValue: {} },
      { provide: ProfileEditPageService, useValue: {} },
      { provide: ProfileSettingsService, useValue: {} }
    ]
  })(ControllersHttpTestModule)

  const app = await NestFactory.create(ControllersHttpTestModule, { logger: false })
  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true
  }))
  await app.listen(0, '127.0.0.1')

  return {
    app,
    baseUrl: await app.getUrl()
  }
}

test('HTTP controllers reject malformed UUIDs before calling domain services', async t => {
  const calls = { friends: [], profiles: [] }
  const domain = {
    async getProfileFriends(profileId, query) {
      calls.friends.push({ profileId, query })
      return []
    },
    async getProfilesByIds(ids) {
      calls.profiles.push(ids)
      return []
    }
  }
  const { app, baseUrl } = await createHttpApp(domain)
  t.after(() => app.close())

  const invalidRouteResponse = await fetch(
    baseUrl + '/api/relationships/friends/not-a-uuid'
  )
  assert.equal(invalidRouteResponse.status, 400)
  assert.deepEqual(calls.friends, [])

  const validId = '550e8400-e29b-41d4-a716-446655440000'
  const invalidQueryResponse = await fetch(
    baseUrl + '/api/profiles/ids?ids=' + validId + '&ids=not-a-uuid'
  )
  assert.equal(invalidQueryResponse.status, 400)
  assert.deepEqual(calls.profiles, [])
})

test('HTTP controllers preserve scalar, repeated and omitted ID query behavior', async t => {
  const calls = { friends: [], profiles: [] }
  const domain = {
    async getProfileFriends(profileId, query) {
      calls.friends.push({ profileId, query })
      return []
    },
    async getProfilesByIds(ids) {
      calls.profiles.push(ids)
      return []
    }
  }
  const { app, baseUrl } = await createHttpApp(domain)
  t.after(() => app.close())

  const validId = '550e8400-e29b-41d4-a716-446655440000'
  const secondId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

  const routeResponse = await fetch(baseUrl + '/api/relationships/friends/' + validId)
  assert.equal(routeResponse.status, 200)
  assert.deepEqual(calls.friends, [{
    profileId: validId,
    query: { page: 1 }
  }])

  const scalarResponse = await fetch(baseUrl + '/api/profiles/ids?ids=' + validId)
  assert.equal(scalarResponse.status, 200)
  assert.deepEqual(calls.profiles[0], [validId])

  const repeatedResponse = await fetch(
    baseUrl + '/api/profiles/ids?ids=' + validId + '&ids=' + secondId
  )
  assert.equal(repeatedResponse.status, 200)
  assert.deepEqual(calls.profiles[1], [validId, secondId])

  const omittedResponse = await fetch(baseUrl + '/api/profiles/ids')
  assert.equal(omittedResponse.status, 200)
  assert.deepEqual(calls.profiles[2], [])
})
