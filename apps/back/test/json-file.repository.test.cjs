const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')
const { JsonFileRepository } = require('../dist/storage/json-file.repository.js')

test('serializes concurrent updates across repository instances', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-json-repository-'))
  const previousDirectory = process.env.DATA_DIRECTORY
  process.env.DATA_DIRECTORY = directory
  const first = new JsonFileRepository()
  const second = new JsonFileRepository()

  t.after(async () => {
    if (previousDirectory === undefined) delete process.env.DATA_DIRECTORY
    else process.env.DATA_DIRECTORY = previousDirectory
    await fs.rm(directory, { recursive: true, force: true })
  })

  const writes = Array.from({ length: 80 }, (_, id) => {
    const repository = id % 2 === 0 ? first : second
    return repository.update('items', records => [...records, { id }])
  })
  await Promise.all(writes)

  const records = await first.read('items')
  assert.equal(records.length, 80)
  assert.deepEqual(new Set(records.map(record => record.id)), new Set(writes.map((_, id) => id)))
})

test('does not persist a collection when an updater returns a non-array value', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-json-repository-'))
  const previousDirectory = process.env.DATA_DIRECTORY
  process.env.DATA_DIRECTORY = directory
  const repository = new JsonFileRepository()

  t.after(async () => {
    if (previousDirectory === undefined) delete process.env.DATA_DIRECTORY
    else process.env.DATA_DIRECTORY = previousDirectory
    await fs.rm(directory, { recursive: true, force: true })
  })

  await repository.update('items', () => [{ id: 'kept' }])
  await assert.rejects(repository.update('items', () => ({})), /must return an array/)
  assert.deepEqual(await repository.read('items'), [{ id: 'kept' }])
})


test('serializes multi-collection transactions against concurrent transactions', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-json-repository-'))
  const previousDirectory = process.env.DATA_DIRECTORY
  process.env.DATA_DIRECTORY = directory
  const first = new JsonFileRepository()
  const second = new JsonFileRepository()

  t.after(async () => {
    if (previousDirectory === undefined) delete process.env.DATA_DIRECTORY
    else process.env.DATA_DIRECTORY = previousDirectory
    await fs.rm(directory, { recursive: true, force: true })
  })

  await Promise.all(Array.from({ length: 40 }, (_, id) => {
    const repository = id % 2 === 0 ? first : second
    return repository.transaction(['left', 'right'], collections => ({
      records: {
        ...collections,
        left: [...collections.left, { id }],
        right: [...collections.right, { id }]
      },
      result: id
    }))
  }))

  const [left, right] = await Promise.all([first.read('left'), second.read('right')])
  assert.equal(left.length, 40)
  assert.equal(right.length, 40)
  assert.deepEqual(
    left.map(record => record.id).sort((a, b) => a - b),
    right.map(record => record.id).sort((a, b) => a - b)
  )
})

test('does not commit any collection when a transaction callback is invalid', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-json-repository-'))
  const previousDirectory = process.env.DATA_DIRECTORY
  process.env.DATA_DIRECTORY = directory
  const repository = new JsonFileRepository()

  t.after(async () => {
    if (previousDirectory === undefined) delete process.env.DATA_DIRECTORY
    else process.env.DATA_DIRECTORY = previousDirectory
    await fs.rm(directory, { recursive: true, force: true })
  })

  await repository.update('left', () => [{ id: 'left-before' }])
  await repository.update('right', () => [{ id: 'right-before' }])
  await assert.rejects(() => repository.transaction(['left', 'right'], collections => ({
    records: { ...collections, left: [{ id: 'left-after' }], right: null },
    result: undefined
  })), /must return an array for "right"/)

  assert.deepEqual(await repository.read('left'), [{ id: 'left-before' }])
  assert.deepEqual(await repository.read('right'), [{ id: 'right-before' }])
})

test('readByIds returns only matching records and skips empty ID lists', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-json-repository-'))
  const previousDirectory = process.env.DATA_DIRECTORY
  process.env.DATA_DIRECTORY = directory
  const repository = new JsonFileRepository()

  t.after(async () => {
    if (previousDirectory === undefined) delete process.env.DATA_DIRECTORY
    else process.env.DATA_DIRECTORY = previousDirectory
    await fs.rm(directory, { recursive: true, force: true })
  })

  await repository.update('profiles', () => [
    { id: 'profile-a', name: 'A' },
    { id: 'profile-b', name: 'B' },
    { id: 'profile-c', name: 'C' }
  ])

  assert.deepEqual(await repository.readByIds('profiles', ['profile-c', 'profile-a']), [
    { id: 'profile-a', name: 'A' },
    { id: 'profile-c', name: 'C' }
  ])
  assert.deepEqual(await repository.readByIds('profiles', []), [])
})
