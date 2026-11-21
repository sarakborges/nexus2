const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const migration = readFileSync(
  join(__dirname, '../sql/071_limit_managed_image_file_size.sql'),
  'utf8'
)

test('managed image Storage buckets enforce the one-MiB file limit', () => {
  assert.match(migration, /update\s+storage\.buckets/i)
  assert.match(migration, /file_size_limit\s*=\s*1048576/i)

  for (const bucket of [
    'nexus-avatars',
    'nexus-community-avatars',
    'nexus-editor-images'
  ]) {
    assert.ok(migration.includes("'" + bucket + "'"), bucket + ' must have the one-MiB Storage cap')
  }

  assert.match(migration, /begin\s*;/i)
  assert.match(migration, /commit\s*;/i)
})
