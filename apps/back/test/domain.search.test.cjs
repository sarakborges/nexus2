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

test('empty and whitespace-only queries reach relational search as an empty listing request', async () => {
  const calls = []
  const expected = {
    items: [],
    page: 2,
    pageSize: 20,
    totalItems: 35,
    totalPages: 2
  }
  const service = new DomainService({
    async searchEntities(query, scope, page, sort) {
      calls.push({ query, scope, page, sort })
      return expected
    }
  }, {})

  const result = await service.searchEntities('   ', 'all', {
    page: 2,
    sort: 'name-desc'
  })

  assert.deepEqual(calls, [{
    query: '',
    scope: 'all',
    page: 2,
    sort: 'name-desc'
  }])
  assert.deepEqual(result, expected)
})

test('empty search preserves the requested scope and pagination', async () => {
  const calls = []
  const service = new DomainService({
    async searchEntities(query, scope, page, sort) {
      calls.push({ query, scope, page, sort })
      return { items: [], page, pageSize: 20, totalItems: 0, totalPages: 1 }
    }
  }, {})

  await service.searchEntities('', 'communities', { page: 3, sort: 'activity-asc' })

  assert.deepEqual(calls, [{
    query: '',
    scope: 'communities',
    page: 3,
    sort: 'activity-asc'
  }])
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
