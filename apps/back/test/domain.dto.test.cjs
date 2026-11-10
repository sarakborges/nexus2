require('reflect-metadata')

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { validateSync } = require('class-validator')
const {
  CreateProfileDto,
  UpdateProfileDto,
  CreateCommunityDto,
  UpdateCommunityDto,
  MessageDto,
  CreateForumTopicDto,
  CreateForumReplyDto
} = require('../dist/api/domain/domain.dto.js')

function hasLengthError(Dto, payload, property) {
  const instance = Object.assign(new Dto(), payload)
  return validateSync(instance).some(error => error.property === property)
}

const profile = about => ({
  name: 'Profile',
  picture: '',
  about,
  type: 'social'
})
const community = about => ({
  name: 'Community',
  picture: '',
  about,
  privacy: 'public',
  ownerProfileId: 'profile-1'
})
const updateProfile = about => ({
  name: 'Profile',
  picture: '',
  about
})
const updateCommunity = about => ({
  name: 'Community',
  picture: '',
  about,
  privacy: 'public'
})
const message = content => ({ fromProfileId: 'profile-1', content })
const topic = content => ({
  profileId: 'profile-1',
  title: 'Topic',
  content
})
const reply = content => ({ profileId: 'profile-1', content })

const cases = [
  ['profile about', CreateProfileDto, profile, 'about'],
  ['profile update about', UpdateProfileDto, updateProfile, 'about'],
  ['community about', CreateCommunityDto, community, 'about'],
  ['community update about', UpdateCommunityDto, updateCommunity, 'about'],
  ['profile message', MessageDto, message, 'content'],
  ['forum topic', CreateForumTopicDto, topic, 'content'],
  ['forum reply', CreateForumReplyDto, reply, 'content']
]

for (const [label, Dto, makePayload, property] of cases) {
  test(`${label} accepts exactly 8000 HTML characters`, () => {
    assert.equal(hasLengthError(Dto, makePayload('x'.repeat(8000)), property), false)
  })

  test(`${label} rejects 8001 HTML characters`, () => {
    assert.equal(hasLengthError(Dto, makePayload('x'.repeat(8001)), property), true)
  })
}
