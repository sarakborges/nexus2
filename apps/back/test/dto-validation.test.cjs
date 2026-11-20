require('reflect-metadata')
const { plainToInstance } = require('class-transformer')
const { ParseUUIDPipe } = require('@nestjs/common')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { validate } = require('class-validator')
const {
  CredentialsDto,
  SignUpDto,
  CurrentProfileDto
} = require('../dist/api/auth/auth.dto.js')
const {
  CreateProfileDto,
  IdsQueryDto,
  UpdateProfileDto,
  CreateCommunityDto,
  UpdateCommunityDto,
  ProfileRelationDto,
  CommunityRelationDto,
  ActorDto,
  OwnershipDto,
  MessageDto,
  CreateForumTopicDto,
  CreateForumReplyDto,
  ForumActorDto
} = require('../dist/api/domain/domain.dto.js')
const { CreateUploadDto, UpdateAvatarDto } = require('../dist/api/uploads/uploads.dto.js')
const { PaginationDto } = require('../dist/api/pagination/pagination.dto.js')

test('authentication DTOs reject oversized email and password values', async () => {
  const credentials = Object.assign(new CredentialsDto(), {
    email: 'person@example.com',
    password: 'p'.repeat(129)
  })
  const credentialErrors = await validate(credentials)
  assert.ok(credentialErrors.some(error =>
    error.property === 'password' && error.constraints?.maxLength
  ))

  const signUp = Object.assign(new SignUpDto(), {
    email: 'a'.repeat(250) + '@example.com',
    password: 'secure-password'
  })
  const signUpErrors = await validate(signUp)
  assert.ok(signUpErrors.some(error =>
    error.property === 'email' && error.constraints?.maxLength
  ))
})

test('all profile and community write DTOs bound URL and picture strings', async () => {
  const dtoTypes = [
    CreateProfileDto,
    UpdateProfileDto,
    CreateCommunityDto,
    UpdateCommunityDto
  ]

  for (const DtoType of dtoTypes) {
    const oversizedUrl = Object.assign(new DtoType(), {
      name: 'Example',
      url: 'u'.repeat(2049),
      picture: '',
      about: '',
      type: 'social',
      privacy: 'public',
      ownerProfileId: 'profile-id'
    })
    const urlErrors = await validate(oversizedUrl)
    assert.ok(
      urlErrors.some(error => error.property === 'url' && error.constraints?.maxLength),
      DtoType.name + ' must reject oversized URLs'
    )

    const oversizedPicture = Object.assign(new DtoType(), {
      name: 'Example',
      url: 'example',
      picture: 'p'.repeat(2049),
      about: '',
      type: 'social',
      privacy: 'public',
      ownerProfileId: 'profile-id'
    })
    const pictureErrors = await validate(oversizedPicture)
    assert.ok(
      pictureErrors.some(error => error.property === 'picture' && error.constraints?.maxLength),
      DtoType.name + ' must reject oversized pictures'
    )
  }
})


test('UUID-backed write DTO fields reject malformed identifiers', async () => {
  const cases = [
    [CurrentProfileDto, 'profileId'],
    [PaginationDto, 'actorProfileId'],
    [CreateCommunityDto, 'ownerProfileId'],
    [ProfileRelationDto, 'sourceProfileId'],
    [CommunityRelationDto, 'actorProfileId'],
    [ActorDto, 'actorProfileId'],
    [OwnershipDto, 'newOwnerProfileId'],
    [MessageDto, 'fromProfileId'],
    [CreateForumTopicDto, 'profileId'],
    [CreateForumReplyDto, 'profileId'],
    [ForumActorDto, 'profileId'],
    [CreateUploadDto, 'targetId'],
    [CreateUploadDto, 'actorProfileId'],
    [UpdateAvatarDto, 'uploadId'],
    [UpdateAvatarDto, 'actorProfileId']
  ]

  for (const [DtoType, property] of cases) {
    const instance = Object.assign(new DtoType(), { [property]: 'not-a-uuid' })
    const errors = await validate(instance)
    assert.ok(
      errors.some(error => error.property === property && error.constraints?.isUuid),
      DtoType.name + '.' + property + ' must reject malformed UUIDs'
    )
  }
})

test('UUID-backed write DTO fields accept valid UUID identifiers', async () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000'
  const cases = [
    [CurrentProfileDto, 'profileId'],
    [PaginationDto, 'actorProfileId'],
    [CreateCommunityDto, 'ownerProfileId'],
    [ProfileRelationDto, 'sourceProfileId'],
    [CommunityRelationDto, 'actorProfileId'],
    [ActorDto, 'actorProfileId'],
    [OwnershipDto, 'newOwnerProfileId'],
    [MessageDto, 'fromProfileId'],
    [CreateForumTopicDto, 'profileId'],
    [CreateForumReplyDto, 'profileId'],
    [ForumActorDto, 'profileId'],
    [CreateUploadDto, 'targetId'],
    [CreateUploadDto, 'actorProfileId'],
    [UpdateAvatarDto, 'uploadId'],
    [UpdateAvatarDto, 'actorProfileId']
  ]

  for (const [DtoType, property] of cases) {
    const instance = Object.assign(new DtoType(), { [property]: validId })
    const errors = await validate(instance)
    assert.ok(
      !errors.some(error => error.property === property && error.constraints?.isUuid),
      DtoType.name + '.' + property + ' must accept a valid UUID'
    )
  }
})


test('ID-list query accepts scalar and repeated UUIDs, defaults to empty, and rejects invalid or oversized lists', async () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000'
  const empty = plainToInstance(IdsQueryDto, {})
  assert.deepEqual(empty.ids, [])
  assert.equal((await validate(empty)).length, 0)

  const scalar = plainToInstance(IdsQueryDto, { ids: validId })
  assert.deepEqual(scalar.ids, [validId])
  assert.equal((await validate(scalar)).length, 0)

  const repeated = plainToInstance(IdsQueryDto, {
    ids: [validId, '6ba7b810-9dad-11d1-80b4-00c04fd430c8']
  })
  assert.equal((await validate(repeated)).length, 0)

  const malformed = plainToInstance(IdsQueryDto, { ids: [validId, 'not-a-uuid'] })
  const malformedErrors = await validate(malformed)
  assert.ok(malformedErrors.some(error => error.property === 'ids' && error.constraints?.isUuid))

  const oversized = plainToInstance(IdsQueryDto, {
    ids: Array.from({ length: 101 }, () => validId)
  })
  const oversizedErrors = await validate(oversized)
  assert.ok(oversizedErrors.some(error => error.property === 'ids' && error.constraints?.arrayMaxSize))
})

test('UUID route parameter pipe accepts UUIDs and rejects malformed identifiers', async () => {
  const pipe = new ParseUUIDPipe()
  const metadata = { type: 'param', data: 'profileId', metatype: String }
  const validId = '550e8400-e29b-41d4-a716-446655440000'
  assert.equal(await pipe.transform(validId, metadata), validId)
  await assert.rejects(pipe.transform('not-a-uuid', metadata))
})
