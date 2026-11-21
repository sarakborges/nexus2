const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const migration = readFileSync(
  join(__dirname, '../sql/076_revoke_elevated_client_table_privileges.sql'),
  'utf8'
)

test('public tables revoke elevated privileges from PUBLIC and client roles', () => {
  assert.match(
    migration,
    /revoke\s+truncate\s*,\s*references\s*,\s*trigger\s*,\s*maintain\s+on all tables in schema public\s+from public,\s*anon,\s*authenticated\s*;/i
  )
  assert.equal((migration.match(/\brevoke\b/gi) || []).length, 1)
})

test('table privilege minimization preserves row-level operations and service_role', () => {
  assert.doesNotMatch(migration, /revoke\s+(?:all|select|insert|update|delete)\b/i)
  assert.doesNotMatch(migration, /\bservice_role\b/i)
  assert.match(migration, /begin;/i)
  assert.match(migration, /commit;/i)
})

test('migration does not change table data, RLS, policies or schema objects', () => {
  assert.doesNotMatch(
    migration,
    /\b(?:delete\s+from|truncate\s+table|drop\s+policy|create\s+policy|disable\s+row\s+level\s+security|alter\s+table|drop\s+table)\b/i
  )
})
