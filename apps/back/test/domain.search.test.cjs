const test = require('node:test')
const assert = require('node:assert/strict')
const { DomainService } = require('../dist/api/domain/domain.service.js')

function createService({ profiles = [], communities = [], communityRelationships = [] } = {}) {
  const collections = {
    profiles,
    communities,
    community_relationships: communityRelationships
  }
  const data = {
    async read(name) {
      return structuredClone(collections[name] ?? [])
    },
    async readByIds(name, ids) {
      const requested = new Set(ids)
      return (collections[name] ?? []).filter(record => requested.has(record.id))
    },
    async update(name, updater) {
      const next = updater(structuredClone(collections[name] ?? []))
      collections[name] = structuredClone(next)
      return structuredClone(next)
    },
    async transaction(names, updater) {
      const snapshot = Object.fromEntries(names.map(name => [
        name,
        structuredClone(collections[name] ?? [])
      ]))
      return structuredClone(updater(snapshot).result)
    }
  }

  return new DomainService(data, {})
}

const profile = (id, overrides = {}) => ({
  id,
  name: id,
  url: id,
  picture: '',
  about: '',
  type: 'social',
  createdAt: 10,
  lastActivity: 10,
  ...overrides
})

const community = (id, overrides = {}) => ({
  id,
  name: id,
  url: id,
  picture: '',
  about: '',
  type: 'social',
  privacy: 'public',
  createdAt: 10,
  lastActivity: 10,
  ...overrides
})

test('search matches case-insensitive substrings in profile and community name, about and URL', async () => {
  const service = createService({
    profiles: [
      profile('name-match', { name: 'Terra Persona' }),
      profile('about-match', { about: '<p>Creative roleplay artist</p>' }),
      profile('url-match', { url: 'roleplay-world' })
    ],
    communities: [
      community('community-name', { name: 'Roleplay Guild' }),
      community('community-about', { about: '<p>A space for roleplay stories</p>' }),
      community('private-community', { name: 'Roleplay private space', privacy: 'private' }),
      community('unlisted-community', { name: 'Roleplay hidden space', privacy: 'unlisted' })
    ],
    communityRelationships: [
      { profiles: ['name-match', 'private-community'], type: 'owner' },
      { profiles: ['name-match', 'unlisted-community'], type: 'owner' }
    ]
  })

  const result = await service.searchEntities('RoLePlAy', 'all', { page: 1 })

  assert.deepEqual(result.items.map(item => item.kind === 'profile'
    ? item.profile.id
    : item.community.id
  ), ['about-match', 'url-match', 'community-name', 'community-about'])
  assert.equal(result.totalItems, 4)
})

test('search scope separates profiles from public communities', async () => {
  const service = createService({
    profiles: [profile('profile-one', { name: 'Open Nexus' })],
    communities: [
      community('community-one', { name: 'Open Nexus community' }),
      community('community-private', { name: 'Open Nexus private', privacy: 'private' })
    ]
  })

  const profiles = await service.searchEntities('open', 'profiles', { page: 1 })
  const communities = await service.searchEntities('open', 'communities', { page: 1 })

  assert.deepEqual(profiles.items.map(item => item.kind), ['profile'])
  assert.equal(profiles.totalItems, 1)
  assert.deepEqual(communities.items.map(item => item.kind), ['community'])
  assert.equal(communities.totalItems, 1)
})

test('search orders results by last activity and defaults missing legacy timestamps to zero', async () => {
  const service = createService({
    profiles: [
      profile('older-profile', {
        name: 'Legacy result',
        createdAt: undefined,
        lastActivity: undefined
      }),
      profile('active-profile', {
        name: 'Legacy active result',
        createdAt: 100,
        lastActivity: 300
      })
    ],
    communities: [
      community('active-community', {
        name: 'Legacy community',
        createdAt: 200,
        lastActivity: 250
      })
    ]
  })

  const result = await service.searchEntities('legacy', 'all', { page: 1 })

  assert.deepEqual(result.items.map(item => item.kind === 'profile'
    ? item.profile.id
    : item.community.id
  ), ['active-profile', 'active-community', 'older-profile'])
  const legacy = result.items.find(item => item.kind === 'profile' && item.profile.id === 'older-profile')
  assert.equal(legacy.profile.createdAt, 0)
  assert.equal(legacy.profile.lastActivity, 0)
})

test('empty search queries return no results without reading collections', async () => {
  let transactions = 0
  const service = new DomainService({
    async transaction() {
      transactions += 1
      throw new Error('SHOULD_NOT_READ')
    }
  }, {})

  const result = await service.searchEntities('   ', 'all', { page: 1 })

  assert.equal(result.totalItems, 0)
  assert.equal(transactions, 0)
})


test('searchEntities uses the targeted relational query and does not load snapshots', async () => {
  const expected = {
    items: [{ kind: 'profile', profile: { id: 'profile-1', name: 'Target' } }],
    page: 2, pageSize: 20, totalItems: 21, totalPages: 2
  }
  const calls = []
  const service = new DomainService({
    async searchEntities(query, scope, page, sort) {
      calls.push({ query, scope, page, sort })
      return expected
    },
    async transaction() { throw new Error('Entity search must not load collection snapshots.') }
  }, {})
  const result = await service.searchEntities(' target ', 'profiles', { page: 2, sort: 'name-asc' })
  assert.deepEqual(calls,[{query:'target',scope:'profiles',page:2,sort:'name-asc'}])
  assert.deepEqual(result,expected)
})
