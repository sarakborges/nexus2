require('reflect-metadata')

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { BadRequestException, ParseUUIDPipe, ValidationPipe } = require('@nestjs/common')
const { ROUTE_ARGS_METADATA, METHOD_METADATA, GUARDS_METADATA } = require('@nestjs/common/constants')
const { RequestMethod } = require('@nestjs/common')
const { JwtAccessGuard } = require('../dist/api/auth/jwt-access.guard.js')
const { DomainController } = require('../dist/api/domain/domain.controller.js')
const { CommunitiesController } = require('../dist/api/domain/communities.controller.js')
const { ProfileMessagesController } = require('../dist/api/domain/profile-messages.controller.js')
const { UploadsController } = require('../dist/api/uploads/uploads.controller.js')
const { ProfilesController } = require('../dist/api/domain/profiles.controller.js')
const { RelationshipsController } = require('../dist/api/domain/relationships.controller.js')
const { IdsQueryDto, RemoveProfileRelationDto } = require('../dist/api/domain/domain.dto.js')
const { PaginationDto } = require('../dist/api/pagination/pagination.dto.js')

const validId = '550e8400-e29b-41d4-a716-446655440000'
const secondId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

const uuidParameterNames = new Set([
  'profileId',
  'communityId',
  'topicId',
  'replyId',
  'messageId',
  'actorProfileId',
  'id'
])
const protectedControllers = [
  DomainController,
  ProfilesController,
  CommunitiesController,
  ProfileMessagesController,
  RelationshipsController,
  UploadsController
]

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


test('every UUID route and query parameter is protected by ParseUUIDPipe', () => {
  for (const ControllerClass of protectedControllers) {
    for (const methodName of Object.getOwnPropertyNames(ControllerClass.prototype)) {
      const args = routeArguments(ControllerClass, methodName)
      for (const argument of Object.values(args)) {
        if (!uuidParameterNames.has(argument.data)) continue
        assert.ok(
          argument.pipes?.some(pipe => pipe instanceof ParseUUIDPipe),
          ControllerClass.name + '.' + methodName + ' must validate ' + argument.data
        )
      }
    }
  }
})

test('every state-changing domain and upload route requires an access-token guard', () => {
  const stateChangingMethods = new Set([
    RequestMethod.POST,
    RequestMethod.PUT,
    RequestMethod.PATCH,
    RequestMethod.DELETE
  ])

  for (const ControllerClass of protectedControllers) {
    for (const methodName of Object.getOwnPropertyNames(ControllerClass.prototype)) {
      const handler = ControllerClass.prototype[methodName]
      if (typeof handler !== 'function') continue
      const method = Reflect.getMetadata(METHOD_METADATA, handler)
      if (!stateChangingMethods.has(method)) continue

      const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? []
      assert.ok(
        guards.includes(JwtAccessGuard),
        ControllerClass.name + '.' + methodName + ' must require JwtAccessGuard'
      )
    }
  }
})


test('remove relationship body uses a runtime DTO and rejects malformed or extra fields', async () => {
  const parameterTypes = Reflect.getMetadata(
    'design:paramtypes',
    RelationshipsController.prototype,
    'removeRelationship'
  )
  assert.equal(parameterTypes?.[1], RemoveProfileRelationDto)

  const validationPipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true
  })
  const metadata = { type: 'body', metatype: parameterTypes[1], data: undefined }
  await assert.rejects(
    validationPipe.transform({
      sourceProfileId: 'not-a-uuid',
      targetProfileId: secondId
    }, metadata),
    error => error instanceof BadRequestException && error.getStatus() === 400
  )
  await assert.rejects(
    validationPipe.transform({
      sourceProfileId: validId,
      targetProfileId: secondId,
      type: 'blocked'
    }, metadata),
    error => error instanceof BadRequestException && error.getStatus() === 400
  )

  const body = await validationPipe.transform({
    sourceProfileId: validId,
    targetProfileId: secondId
  }, metadata)
  const calls = []
  const controller = new RelationshipsController({
    removeProfileRelationship(...args) {
      calls.push(args)
    }
  })
  await controller.removeRelationship({ id: 'account-1' }, body)
  assert.deepEqual(calls, [['account-1', validId, secondId]])
})

test('community member tab is validated through PaginationDto instead of an untyped query parameter', async () => {
  const parameterTypes = Reflect.getMetadata(
    'design:paramtypes',
    RelationshipsController.prototype,
    'members'
  )
  assert.equal(parameterTypes?.[2], PaginationDto)
  const args = routeArguments(RelationshipsController, 'members')
  assert.ok(
    Object.values(args).some(argument => argument.index === 2),
    'members must bind the PaginationDto as a query object'
  )

  const validationPipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true
  })
  const metadata = { type: 'query', metatype: parameterTypes[2], data: undefined }
  await assert.rejects(
    validationPipe.transform({ tab: 'unexpected' }, metadata),
    error => error instanceof BadRequestException && error.getStatus() === 400
  )
  const query = await validationPipe.transform({ tab: 'staff' }, metadata)
  const calls = []
  const controller = new RelationshipsController({
    listCommunityMembers(...args) {
      calls.push(args)
    }
  })
  await controller.members(validId, { id: 'account-1' }, query)
  assert.equal(calls[0][0], validId)
  assert.equal(calls[0][1], 'staff')
  assert.equal(calls[0][3], 'account-1')
})
