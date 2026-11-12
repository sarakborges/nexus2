const test = require('node:test')
const assert = require('node:assert/strict')
const { DomainAccessService } = require('../dist/api/domain/domain-access.service.js')
const { CommunityService } = require('../dist/api/domain/community.service.js')

test('community ID lookups read and normalize only the requested communities', async () => {
  const calls = []
  const repository = {
    async getCommunitiesByIds(ids) {
      calls.push({ ids })
      return [
        {
          id: 'private-community',
          name: 'Private',
          url: 'private',
          picture: '',
          about: '<p>Private text</p>',
          type: 'social',
          privacy: 'private'
        },
        {
          id: 'public-community',
          name: 'Public',
          url: 'public',
          picture: '',
          about: '<p>Public text</p>',
          type: 'rp'
        }
      ]
    },
    async transaction() {
      throw new Error('FULL_COMMUNITY_SNAPSHOT_SHOULD_NOT_RUN')
    }
  }
  const access = new DomainAccessService(repository)
  const service = new CommunityService(repository, {}, access)

  const result = await service.getCommunitiesByIds([
    'private-community',
    'public-community',
    'public-community'
  ])

  assert.deepEqual(calls, [{ ids: ['private-community', 'public-community'] }])
  assert.deepEqual(result.map(community => community.id), ['public-community'])
  assert.equal(result[0].privacy, 'public')
  assert.equal(result[0].createdAt, 0)
  assert.equal(result[0].lastActivity, 0)
  assert.equal(result[0].about, '<p>Public text</p>')
})

test('community ID lookups receive inherited owner types from the typed relational query', async () => {
  const legacy = {
    id: 'legacy-community',
    name: 'Legacy',
    url: 'legacy',
    picture: '',
    about: '',
    type: 'business',
    privacy: 'public',
    createdAt: 10,
    lastActivity: 10
  }
  let queryCount = 0
  const repository = {
    async getCommunitiesByIds(ids) {
      queryCount += 1
      assert.deepEqual(ids, ['legacy-community'])
      return [legacy]
    },
    async transaction() {
      throw new Error('Community ID lookup must not load collection snapshots.')
    }
  }
  const access = new DomainAccessService(repository)
  const result = await access.readCommunitiesByIds(['legacy-community'])
  assert.equal(queryCount, 1)
  assert.equal(result.length, 1)
  assert.equal(result[0].type, 'business')
})

test('empty community ID lookups do not read storage', async () => {
  const repository = {
    async getCommunitiesByIds() {
      throw new Error('READ_SHOULD_NOT_RUN')
    },
    async transaction() {
      throw new Error('TRANSACTION_SHOULD_NOT_RUN')
    }
  }
  const access = new DomainAccessService(repository)

  assert.deepEqual(await access.readCommunitiesByIds([]), [])
})


test('public community listing uses a targeted page query and sanitizes returned descriptions', async () => {
  const calls = []
  const community = {
    id: 'community-1', name: 'Community', url: 'community', picture: '',
    about: '<p>About</p><script>unsafe()</script>', type: 'rp', privacy: 'public',
    createdAt: 1, lastActivity: 2
  }
  const repository = {
    async getPublicCommunities(page) {
      calls.push(page)
      return { items: [community], page, pageSize: 20, totalItems: 1, totalPages: 1 }
    },
    async transaction() { throw new Error('Public community listing must not load snapshots.') }
  }
  const service = new CommunityService(repository, {}, new DomainAccessService(repository))
  const result = await service.listCommunities({ page: 2 })
  assert.deepEqual(calls,[2])
  assert.equal(result.items[0].about.includes('<script>'),false)
})
