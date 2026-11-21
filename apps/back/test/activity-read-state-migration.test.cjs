const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const migration = readFileSync(
  join(__dirname, '../sql/072_activity_notification_read_scope.sql'),
  'utf8'
)

function functionBody(schema, name) {
  const start = migration.indexOf(`create or replace function ${schema}.${name}(`)
  assert.notEqual(start, -1, `migration must redefine ${schema}.${name}`)
  const end = migration.indexOf('$function$;', start)
  assert.notEqual(end, -1, `${schema}.${name} must have a complete function body`)
  return migration.slice(start, end)
}

const visibility = functionBody('private', 'nexus_visible_activity_ids_for_account')
const markRead = functionBody('public', 'nexus_mark_activities_read')

test('notification read validation is scoped to the requested IDs, not a paginated feed window', () => {
  assert.match(visibility, /activity\.id = any\(coalesce\(p_activity_ids, array\[\]::text\[\]\)\)/i)
  assert.doesNotMatch(visibility, /\blimit\b/i)
  assert.match(markRead, /from private\.nexus_visible_activity_ids_for_account\(p_user_id, p_activity_ids\)/i)
  assert.doesNotMatch(markRead, /nexus_get_activity_feed_page/i)
})

test('notification read visibility preserves the feed profile and relationship rules', () => {
  assert.match(visibility, /account\.current_profile_id/i)
  assert.match(visibility, /active_membership\.deleted_at_ms is null/i)
  assert.match(visibility, /relationship\.type = 'connection'/i)
  assert.match(visibility, /relationship\.deleted_at_ms is null/i)
  assert.match(visibility, /friend_profile\.type = active_profile\.type/i)
  assert.match(visibility, /visible_profiles as/i)
  assert.match(visibility, /event\.type = 'friend_connected'/i)
  assert.match(visibility, /event\.type <> 'friend_connected'/i)
})

test('notification read visibility preserves publisher and viewer preferences', () => {
  assert.match(visibility, /publisher_preference\.publish_activity = true/i)
  assert.match(visibility, /viewer_preference\.show_friend_activity = true/i)
  assert.match(visibility, /publisher_settings\.deleted_at_ms is null/i)
  assert.match(visibility, /viewer_settings\.deleted_at_ms is null/i)
})

test('notification read visibility preserves community privacy and post existence checks', () => {
  assert.match(visibility, /community\.type = actor\.type/i)
  assert.match(visibility, /community\.privacy = 'public'/i)
  assert.match(visibility, /post\.id is not null/i)
  assert.match(visibility, /event\.type not in \('community_created', 'community_membership'\)/i)
})

test('notification read RPC remains server-authorized, active-account-only and capped at 50 IDs', () => {
  assert.match(markRead, /private\.nexus_server_request_authorized\(\)/i)
  assert.match(markRead, /account\.deleted_at_ms is null/i)
  assert.match(markRead, /cardinality\(p_activity_ids\), 0\) > 50/i)
  assert.match(markRead, /on conflict \(account_id, activity_id\) do update/i)
  assert.match(markRead, /deleted_at_ms = null/i)
})

test('notification visibility helper is server-only and its EXECUTE grant is explicit', () => {
  assert.match(migration, /revoke all on function private\.nexus_visible_activity_ids_for_account\(uuid, text\[\]\)\s+from public, authenticated/i)
  assert.match(migration, /grant execute on function private\.nexus_visible_activity_ids_for_account\(uuid, text\[\]\)\s+to anon/i)
  assert.match(migration, /revoke all on function public\.nexus_mark_activities_read\(uuid, text\[\], bigint\)\s+from public, authenticated/i)
  assert.match(migration, /grant execute on function public\.nexus_mark_activities_read\(uuid, text\[\], bigint\)\s+to anon/i)
})
