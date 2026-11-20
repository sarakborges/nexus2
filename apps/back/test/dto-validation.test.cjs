const assert = require('node:assert/strict')
const { test } = require('node:test')
const { validate } = require('class-validator')
const { CredentialsDto, SignUpDto } = require('../dist/api/auth/auth.dto.js')
const {
  CreateProfileDto,
  UpdateProfileDto,
  CreateCommunityDto,
  UpdateCommunityDto
} = require('../dist/api/domain/domain.dto.js')

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
