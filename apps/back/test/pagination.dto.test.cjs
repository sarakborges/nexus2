require('reflect-metadata')

const test = require('node:test')
const assert = require('node:assert/strict')
const { plainToInstance } = require('class-transformer')
const { validateSync } = require('class-validator')
const { PaginationDto } = require('../dist/api/pagination/pagination.dto.js')
const { paginate } = require('../dist/api/pagination/pagination.helper.js')

test('pagination always uses 20 items even when a URL supplies another page size', () => {
  const query = plainToInstance(PaginationDto, { page: '2', pageSize: '1' })
  assert.equal(query.page, 2)
  assert.equal(query.pageSize, 20)
  assert.deepEqual(validateSync(query), [])

  const rows = Array.from({ length: 45 }, (_, index) => index)
  const result = paginate(rows, query)

  assert.equal(result.page, 2)
  assert.equal(result.pageSize, 20)
  assert.equal(result.totalPages, 3)
  assert.equal(result.items.length, 20)
  assert.equal(result.items[0], 20)
})
