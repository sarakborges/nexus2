require('reflect-metadata')

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { BadRequestException, ParseUUIDPipe, ValidationPipe } = require('@nestjs/common')
const { ROUTE_ARGS_METADATA } = require('@nestjs/common/constants')
const { ProfilesController } = require('../dist/api/domain/profiles.controller.js')
const { RelationshipsController } = require('../dist/api/domain/relationships.controller.js')
const { IdsQueryDto } = require('../dist/api/domain/domain.dto.js')

const validId = '550e8400-e29b-41d4-a716-446655440000'
const secondId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

function routeArguments(controller, methodName) {
  return Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    controller,
    methodName
  ) ?? {}
}

test('friends route binds ParseUUIDPipe and rejects invalid profile IDs before calling the service', async () => {
  const args = routeArguments(RelationshipsController, 'getFriends')
  const profileArgument = Object.values(args).find(argument => argument.data === 'profileId')
  assert.ok(profileArgument, 'profileId route argument must be registered')
  const pipe = profileArgument.pipes.find(candidate => candidate instanceof ParseUUIDPipe)
  assert.ok(pipe, 'profileId must use ParseUUIDPipe')

  const calls = []
  const controller = new RelationshipsController({
    getProfileFriends(profileId, query) {
      calls.push({ profileId, query })
      return []
    }
  })
  const metadata = { type: 'param', data: 'profileId', metatype: String }

  await assert.rejects(
    pipe.transform('not-a-uuid', metadata),
    error => error instanceof BadRequestException && error.getStatus() === 400
  )
  assert.deepEqual(calls, [])

  const parsedId = await pipe.transform(validId, metadata)
  await controller.getFriends(parsedId, { page: 1 })
  assert.deepEqual(calls, [{ profileId: validId, query: { page: 1 } }])
})

test('profiles IDs route binds IdsQueryDto and validates query values before calling the service', async () => {
  const args = routeArguments(ProfilesController, 'getProfiles')
  assert.ok(Object.values(args).some(argument => argument.index === 0))
  const parameterTypes = Reflect.getMetadata(
    'design:paramtypes',
    ProfilesController.prototype,
    'getProfiles'
  )
  assert.equal(parameterTypes?.[0], IdsQueryDto)

  const calls = []
  const controller = Object.create(ProfilesController.prototype)
  controller.domain = {
    getProfilesByIds(ids) {
      calls.push(ids)
      return []
    }
  }
  const validationPipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true
  })
  const metadata = { type: 'query', metatype: parameterTypes[0], data: undefined }

  await assert.rejects(
    validationPipe.transform({ ids: [validId, 'not-a-uuid'] }, metadata),
    error => error instanceof BadRequestException && error.getStatus() === 400
  )
  await assert.rejects(
    validationPipe.transform({ ids: Array.from({ length: 101 }, () => validId) }, metadata),
    error => error instanceof BadRequestException && error.getStatus() === 400
  )
  assert.deepEqual(calls, [])

  const scalar = await validationPipe.transform({ ids: validId }, metadata)
  await controller.getProfiles(scalar)
  assert.deepEqual(calls[0], [validId])

  const repeated = await validationPipe.transform({ ids: [validId, secondId] }, metadata)
  await controller.getProfiles(repeated)
  assert.deepEqual(calls[1], [validId, secondId])

  const omitted = await validationPipe.transform({}, metadata)
  await controller.getProfiles(omitted)
  assert.deepEqual(calls[2], [])
})
