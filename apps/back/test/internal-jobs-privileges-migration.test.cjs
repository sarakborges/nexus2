const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const migration = readFileSync(
  join(__dirname, '../sql/074_revoke_client_access_to_internal_jobs.sql'),
  'utf8'
)

const workerTables = [
  'jobs_active',
  'jobs_contact_outbox',
  'jobs_dedupe',
  'jobs_discovery_state',
  'jobs_interaction_keys',
  'jobs_interactions',
  'jobs_legacy_active_snapshot',
  'jobs_pending',
  'jobs_runs',
  'jobs_state',
  'prospect_contacts',
  'prospect_interactions',
  'prospect_pending',
  'prospect_runs',
  'prospects',
  'prospects_state'
]

const workerFunctions = [
  'jobs_pending_enforce_status',
  'jobs_pending_expected_status',
  'normalize_jobs_source',
  'record_jobs_discovery_result',
  'set_jobs_active_id'
]

test('internal worker tables revoke all client and PUBLIC privileges', () => {
  const revoke = migration.match(
    /revoke all privileges on table([\s\S]*?)from public, anon, authenticated;/i
  )
  assert.ok(revoke, 'migration must revoke table privileges from all client roles')
  for (const table of workerTables) {
    assert.match(revoke[1], new RegExp('public\\.' + table + '\\b', 'i'), table)
  }
  assert.equal(
    (revoke[1].match(/public\./gi) || []).length,
    workerTables.length,
    'revoke statement must target exactly the audited worker-owned table set'
  )
  assert.doesNotMatch(migration, /from public, anon, authenticated, service_role/i)
})

test('worker helper functions revoke default PUBLIC and client EXECUTE then grant service_role', () => {
  for (const name of workerFunctions) {
    const escaped = name.replace(/[.*+?^$()|[\]\\]/g, '\\$&')
    const revoke = new RegExp(
      'revoke all on function public\\.' + escaped + '\\([\\s\\S]*?\\)\\s+from public, anon, authenticated;',
      'i'
    )
    const grant = new RegExp(
      'grant execute on function public\\.' + escaped + '\\([\\s\\S]*?\\)\\s+to service_role;',
      'i'
    )
    assert.match(migration, revoke, name + ' must revoke client execution')
    assert.match(migration, grant, name + ' must remain executable by service_role')
  }
})

test('privilege hardening does not alter worker data or RLS policy state', () => {
  assert.doesNotMatch(migration, /\b(delete\s+from|truncate|drop\s+policy|disable\s+row\s+level\s+security)\b/i)
  assert.match(migration, /begin;/i)
  assert.match(migration, /commit;/i)
})
