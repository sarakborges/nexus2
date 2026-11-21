const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const migration = readFileSync(
  join(__dirname, '../sql/066_harden_private_community_read_membership_type.sql'),
  'utf8'
)

function functionBody(name) {
  const start = migration.indexOf(`create or replace function public.${name}(`)
  assert.notEqual(start, -1, `migration must redefine ${name}`)
  const end = migration.indexOf('$function$;', start)
  assert.notEqual(end, -1, `${name} must have a complete function body`)
  return migration.slice(start, end)
}

const protectedReadFunctions = [
  'nexus_get_community_forum_page',
  'nexus_get_community_forum_topic_page',
  'nexus_get_community_members_page',
  'nexus_list_community_members'
]

for (const name of protectedReadFunctions) {
  test(`${name} requires matching profile type for private-community membership access`, () => {
    const body = functionBody(name)
    assert.match(body, /join public\.profiles member_profile\s+on member_profile\.id = (?:relationship|r)\.profile_id/i)
    assert.match(body, /member_profile\.type = (?:v_community|c)\.type/i)
    assert.match(body, /(?:relationship|r)\.type in \('owner',\s*'moderator',\s*'connection'\)/i)
  })
}
