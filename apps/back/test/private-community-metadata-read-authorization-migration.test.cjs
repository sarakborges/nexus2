const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const migration = readFileSync(
  join(__dirname, '../sql/067_harden_private_community_metadata_reads.sql'),
  'utf8'
)

function body(name) {
  const start = migration.indexOf(`create or replace function public.${name}(`)
  assert.notEqual(start, -1, `migration must redefine ${name}`)
  const end = migration.indexOf('$function$;', start)
  assert.notEqual(end, -1, `${name} must be complete`)
  return migration.slice(start, end)
}

for (const name of [
  'nexus_get_community_edit_page',
  'nexus_get_community_forum_composer_page',
  'nexus_get_community_by_url'
]) {
  test(`${name} requires a matching profile type for private-community metadata`, () => {
    const sql = body(name)
    assert.match(sql, /join public\.profiles member_profile on member_profile\.id = r\.profile_id/i)
    assert.match(sql, /member_profile\.type = c\.type/i)
    assert.match(sql, /r\.type in \('owner','moderator','connection'\)/i)
  })
}

test('private editor-image authorization uses the owner-inherited community type', () => {
  const sql = body('nexus_get_editor_image')
  assert.match(sql, /owner_relation\.type = 'owner'/i)
  assert.match(sql, /owner_profile\.type/i)
  assert.match(sql, /coalesce\([\s\S]*owner_profile\.type[\s\S]*community\.type[\s\S]*\)[\s\S]*into v_privacy,v_community_type/i)
  assert.match(sql, /member_profile\.type=v_community_type/i)
})
