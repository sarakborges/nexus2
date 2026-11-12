const test = require('node:test')
const assert = require('node:assert/strict')
const { DomainService } = require('../dist/api/domain/domain.service.js')

test('search delegates normalized query, scope, pagination and sort to the relational repository', async () => {
  const expected = {
    items: [{ kind: 'profile', profile: { id: 'profile-1', name: 'Target' } }],
    page: 2,
    pageSize: 20,
    totalItems: 21,
    totalPages: 2
  }
  const calls = []
  const service = new DomainService({
    async searchEntities(query, scope, page, sort) {
      calls.push({ query, scope, page, sort })
      return expected
    },
    async transaction() {
      throw new Error('Entity search must not load collection snapshots.')
    }
  }, {})

  const result = await service.searchEntities(
    ' Target ', 'profiles', { page: 2, sort: 'name-asc' }
  )

  assert.deepEqual(calls, [{
    query: 'target',
    scope: 'profiles',
    page: 2,
    sort: 'name-asc'
  }])
  assert.deepEqual(result, expected)
})

test('empty search queries return an empty page without querying the repository', async () => {
  let calls = 0
  const service = new DomainService({
    async searchEntities() {
      calls += 1
      throw new Error('EMPTY_QUERY_MUST_NOT_REACH_DATABASE')
    }
  }, {})

  const result = await service.searchEntities('   ', 'all', { page: 3 })

  assert.equal(result.totalItems, 0)
  assert.equal(result.page, 1)
  assert.equal(calls, 0)
})

test('search propagates relational repository errors', async () => {
  const service = new DomainService({
    async searchEntities() {
      throw new Error('SEARCH_QUERY_FAILED')
    }
  }, {})

  await assert.rejects(
    service.searchEntities('target', 'all', { page: 1 }),
    /SEARCH_QUERY_FAILED/
  )
})
