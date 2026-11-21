const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const migration = readFileSync(
  join(__dirname, '../sql/077_revoke_unused_authenticated_role_access.sql'),
  'utf8'
)

test('the unused authenticated role loses existing public table access', () => {
  assert.match(
    migration,
    /revoke all privileges on all tables in schema public\s+from authenticated\s*;/i
  )
  assert.match(
    migration,
    /revoke all privileges on all sequences in schema public\s+from authenticated\s*;/i
  )
  assert.match(
    migration,
    /revoke execute on all functions in schema public\s+from authenticated\s*;/i
  )
})

test('anon keeps public API table and function access; only the worker sequence is removed', () => {
  assert.match(
    migration,
    /revoke all privileges on all sequences in schema public\s+from public, anon\s*;/i
  )
  assert.doesNotMatch(
    migration,
    /revoke all privileges on all tables in schema public\s+from [^;]*\banon\b/i
  )
  assert.doesNotMatch(
    migration,
    /revoke execute on all functions in schema public\s+from [^;]*\banon\b/i
  )
  assert.doesNotMatch(migration, /\bservice_role\b/i)
})

test('role cleanup does not change data, table definitions or RLS policies', () => {
  assert.doesNotMatch(
    migration,
    /\b(?:delete\s+from|truncate\s+table|drop\s+policy|create\s+policy|disable\s+row\s+level\s+security|alter\s+table|drop\s+table)\b/i
  )
  assert.match(migration, /notify pgrst, 'reload schema'/i)
  assert.match(migration, /begin;/i)
  assert.match(migration, /commit;/i)
})
