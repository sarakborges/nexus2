const test = require('node:test')
const assert = require('node:assert/strict')
const { ProfileService } = require('../dist/api/domain/profile.service.js')
const { CommunityService } = require('../dist/api/domain/community.service.js')
const { DomainAccessService } = require('../dist/api/domain/domain-access.service.js')

const uniqueViolation = code => new Error(
  'Supabase relational request failed (409): {"code":"23505","message":"' + code + '"}'
)

test('profile creation appends the first available numeric URL suffix', async () => {
  const attemptedUrls = []
  const occupied = new Set(['same-name', 'same-name-2'])
  const data = {
    async createProfile(change) {
      attemptedUrls.push(change.profile.url)
      if (occupied.has(change.profile.url)) {
        throw uniqueViolation('PROFILE_URL_ALREADY_IN_USE')
      }
      return {
        id: change.userId,
        email: 'person@example.test',
        profiles: [change.profile.id],
        currentProfile: change.profile.id
      }
    }
  }
  const service = new ProfileService(data, {}, new DomainAccessService(data))

  const result = await service.createProfile('account-1', {
    name: 'Same Name',
    url: 'same-name',
    picture: '',
    about: '',
    type: 'social'
  })

  assert.deepEqual(attemptedUrls, ['same-name', 'same-name-2', 'same-name-3'])
  assert.equal(result.profile.url, 'same-name-3')
  assert.equal(result.user.currentProfile, result.profile.id)
})

test('community creation appends the first available numeric URL suffix', async () => {
  const attemptedUrls = []
  const occupied = new Set(['same-community', 'same-community-2'])
  const data = {
    async createCommunity(change) {
      attemptedUrls.push(change.url)
      if (occupied.has(change.url)) {
        throw uniqueViolation('COMMUNITY_URL_ALREADY_IN_USE')
      }
      return {
        id: change.id,
        name: change.name,
        url: change.url,
        picture: change.picture,
        about: change.about,
        type: 'social',
        privacy: change.privacy,
        createdAt: change.createdAt,
        lastActivity: change.createdAt
      }
    }
  }
  const service = new CommunityService(data, {}, new DomainAccessService(data))

  const result = await service.createCommunity('account-1', 'owner-profile', {
    name: 'Same Community',
    url: 'same-community',
    picture: '',
    about: '',
    privacy: 'public'
  })

  assert.deepEqual(attemptedUrls, ['same-community', 'same-community-2', 'same-community-3'])
  assert.equal(result.url, 'same-community-3')
})

test('profile creation does not retry unrelated database unique violations', async () => {
  let attempts = 0
  const data = {
    async createProfile() {
      attempts += 1
      throw new Error('Supabase relational request failed (409): {"code":"23505","message":"PROFILE_ID_ALREADY_EXISTS"}')
    }
  }
  const service = new ProfileService(data, {}, new DomainAccessService(data))

  await assert.rejects(
    service.createProfile('account-1', {
      name: 'Profile',
      url: 'profile',
      picture: '',
      about: '',
      type: 'social'
    }),
    /PROFILE_ID_ALREADY_EXISTS/
  )
  assert.equal(attempts, 1)
})
