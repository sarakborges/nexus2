const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const migration = readFileSync(
  join(__dirname, '../sql/068_harden_managed_communities_profile_type.sql'),
  'utf8'
)
const start = migration.indexOf('create or replace function public.nexus_get_communities_page(')
assert.notEqual(start, -1)
const end = migration.indexOf('$function$;', start)
assert.notEqual(end, -1)
const sql = migration.slice(start, end)

test('managed community counts and items require matching manager/community profile types', () => {
  const join = /join public\.profiles manager_profile\s+on manager_profile\.id = relation\.profile_id/gi
  const guard = /manager_profile\.type = coalesce\(owner\.type,c\.type\)/gi
  assert.equal((sql.match(join) ?? []).length, 2)
  assert.equal((sql.match(guard) ?? []).length, 2)
  assert.equal((sql.match(/relation\.type in \('owner','moderator'\)/gi) ?? []).length, 2)
})
