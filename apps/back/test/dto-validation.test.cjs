require('reflect-metadata')
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
