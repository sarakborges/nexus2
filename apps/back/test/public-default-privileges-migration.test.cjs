const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const migration = readFileSync(
  join(__dirname, '../sql/075_opt_in_public_default_privileges.sql'),
  'utf8'
)

test('future public tables and sequences do not inherit client or PUBLIC grants', () => {
  assert.match(
    migration,
    /alter default privileges for role postgres in schema public\s+revoke all privileges on tables from public, anon, authenticated/i
  )
  assert.match(
    migration,
    /alter default privileges for role postgres in schema public\s+revoke all privileges on sequences from public, anon, authenticated/i
  )
})

test('future public functions do not inherit client or PUBLIC EXECUTE', () => {
  assert.match(
    migration,
    /alter default privileges for role postgres in schema public\s+revoke execute on functions from public, anon, authenticated/i
  )
})

test('default privilege changes preserve service_role and Supabase-managed owner defaults', () => {
  assert.doesNotMatch(migration, /service_role/i)
  assert.doesNotMatch(migration, /supabase_admin/i)
  assert.match(migration, /for role postgres in schema public/gi)
  assert.equal((migration.match(/alter default privileges/gi) || []).length, 3)
})

test('default privilege migration affects future objects only', () => {
  assert.doesNotMatch(migration, /revoke all privileges on all tables/i)
  assert.doesNotMatch(migration, /alter table\s+public\./i)
  assert.doesNotMatch(migration, /delete\s+from|truncate\s+/i)
  assert.match(migration, /begin;/i)
  assert.match(migration, /commit;/i)
})
