const test = require('node:test')
const assert = require('node:assert/strict')
const { DomainAccessService } = require('../dist/api/domain/domain-access.service.js')
const { CommunityService } = require('../dist/api/domain/community.service.js')

test('community ID lookups read and normalize only the requested communities', async () => {
  const calls = []
  const repository = {
    async readByIds(collection, ids) {
      calls.push({ collection, ids })
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

  assert.deepEqual(calls, [{
    collection: 'communities',
    ids: ['private-community', 'public-community']
  }])
  assert.deepEqual(result.map(community => community.id), ['public-community'])
  assert.equal(result[0].privacy, 'public')
  assert.equal(result[0].createdAt, 0)
  assert.equal(result[0].lastActivity, 0)
  assert.equal(result[0].about, '<p>Public text</p>')
})

test('community ID lookups retain owner-type normalization for legacy records', async () => {
  const legacy = {
    id: 'legacy-community',
    name: 'Legacy',
    url: 'legacy',
    picture: '',
    about: '',
    privacy: 'public',
    createdAt: 10
  }
  let transactionCalls = 0
  const repository = {
    async readByIds(collection, ids) {
      assert.equal(collection, 'communities')
      assert.deepEqual(ids, ['legacy-community'])
      return [legacy]
    },
    async transaction(collections, updater) {
      transactionCalls += 1
      assert.deepEqual(collections, [
        'communities',
        'profiles',
        'community_relationships'
      ])
      const snapshot = {
        communities: [legacy],
        profiles: [{
          id: 'owner-profile',
          type: 'business'
        }],
        community_relationships: [{
          profiles: ['owner-profile', 'legacy-community'],
          type: 'owner'
        }]
      }
      return updater(snapshot).result
    }
  }
  const access = new DomainAccessService(repository)

  const result = await access.readCommunitiesByIds(['legacy-community'])

  assert.equal(transactionCalls, 1)
  assert.equal(result.length, 1)
  assert.equal(result[0].type, 'business')
})

test('empty community ID lookups do not read storage', async () => {
  const repository = {
    async readByIds() {
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
