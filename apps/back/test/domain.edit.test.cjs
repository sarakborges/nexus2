const test = require('node:test')
const assert = require('node:assert/strict')
const { DomainService } = require('../dist/api/domain/domain.service.js')

const profiles = [
  { id: 'owner-profile', name: 'Owner', url: 'owner', picture: '', about: '', type: 'social' },
  { id: 'member-profile', name: 'Member', url: 'member', picture: '', about: '', type: 'social' }
]
const community = {
  id: 'community-1',
  name: 'Old community',
  url: 'old-community',
  picture: '',
  about: '',
  type: 'social'
}
const ownerRelationship = {
  profiles: ['owner-profile', 'community-1'],
  type: 'owner',
  requestedBy: null,
  blockedBy: null,
  updatedAt: 1
}
const page = { page: 1, pageSize: 20 }

function createService({ ownedProfiles = ['owner-profile'], relationships = [ownerRelationship] } = {}) {
  const collections = new Map([
    ['profiles', structuredClone(profiles)],
    ['communities', [structuredClone(community)]],
    ['community_relationships', structuredClone(relationships)]
  ])
  const data = {
    async read(name) {
      return structuredClone(collections.get(name) ?? [])
    },
    async write(name, records) {
      collections.set(name, structuredClone(records))
    }
  }
  const auth = {
    async ownsProfile(_userId, profileId) {
      return ownedProfiles.includes(profileId)
    },
    async getUser(id) {
      return { id, email: 'owner@example.test', profiles: ownedProfiles, currentProfile: ownedProfiles[0] ?? null }
    }
  }
  return { service: new DomainService(data, auth), collections }
}

test('profile owner can update profile details and change its URL', async () => {
  const { service, collections } = createService()

  const updated = await service.updateProfile('user', 'owner-profile', {
    name: 'Updated owner',
    url: 'updated-owner',
    picture: '',
    about: '<p>New <strong>description</strong></p>',
    type: 'business'
  })

  assert.equal(updated.id, 'owner-profile')
  assert.equal(updated.name, 'Updated owner')
  assert.equal(updated.url, 'updated-owner')
  assert.equal(updated.type, 'business')
  assert.match(collections.get('profiles')[0].about, /<strong>description<\/strong>/)
})

test('profile cannot be updated by an account that does not own it', async () => {
  const { service } = createService({ ownedProfiles: ['member-profile'] })

  await assert.rejects(
    service.updateProfile('member-user', 'owner-profile', {
      name: 'Impersonated',
      url: 'impersonated',
      picture: '',
      about: '',
      type: 'social'
    }),
    error => error.getStatus() === 403 && error.message === 'PROFILE_NOT_OWNED'
  )
})

test('profile update rejects a URL already used by another profile', async () => {
  const { service } = createService()

  await assert.rejects(
    service.updateProfile('user', 'owner-profile', {
      name: 'Owner',
      url: 'member',
      picture: '',
      about: '',
      type: 'social'
    }),
    error => error.getStatus() === 409 && error.message === 'PROFILE_URL_ALREADY_IN_USE'
  )
})

test('community owner can update the community', async () => {
  const { service, collections } = createService()

  const updated = await service.updateCommunity('user', 'community-1', 'owner-profile', {
    name: 'Updated community',
    url: 'updated-community',
    picture: '',
    about: '<p>Community <em>description</em></p>',
    type: 'rp'
  })

  assert.equal(updated.id, 'community-1')
  assert.equal(updated.name, 'Updated community')
  assert.equal(updated.url, 'updated-community')
  assert.equal(updated.type, 'rp')
  assert.match(collections.get('communities')[0].about, /<em>description<\/em>/)
})

test('community moderator cannot update community details', async () => {
  const moderatorRelationship = {
    ...ownerRelationship,
    profiles: ['member-profile', 'community-1'],
    type: 'moderator'
  }
  const { service } = createService({
    ownedProfiles: ['member-profile'],
    relationships: [ownerRelationship, moderatorRelationship]
  })

  await assert.rejects(
    service.updateCommunity('member-user', 'community-1', 'member-profile', {
      name: 'Unauthorized update',
      url: 'unauthorized-update',
      picture: '',
      about: '',
      type: 'social'
    }),
    error => error.getStatus() === 403 && error.message === 'COMMUNITY_OWNER_REQUIRED'
  )
})

test('community update rejects a URL already used by another community', async () => {
  const { service, collections } = createService()
  collections.set('communities', [
    community,
    { ...community, id: 'community-2', name: 'Other', url: 'other-community' }
  ])

  await assert.rejects(
    service.updateCommunity('user', 'community-1', 'owner-profile', {
      name: 'Owner',
      url: 'other-community',
      picture: '',
      about: '',
      type: 'social'
    }),
    error => error.getStatus() === 409 && error.message === 'COMMUNITY_URL_ALREADY_IN_USE'
  )
})
