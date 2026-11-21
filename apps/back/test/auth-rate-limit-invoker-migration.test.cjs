const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const initialMigration = readFileSync(
  join(__dirname, '../sql/063_auth_rate_limits.sql'),
  'utf8'
)
const hardeningMigration = readFileSync(
  join(__dirname, '../sql/073_auth_rate_limit_invoker_rls.sql'),
  'utf8'
)

test('auth rate-limit RPC executes with invoker privileges', () => {
  assert.match(
    hardeningMigration,
    /alter function public\.nexus_consume_auth_rate_limit\(text, bigint, integer\)\s+security invoker/i
  )
  assert.doesNotMatch(
    hardeningMigration,
    /alter function public\.nexus_consume_auth_rate_limit\(text, bigint, integer\)\s+security definer/i
  )
  assert.match(
    hardeningMigration,
    /revoke all on function public\.nexus_consume_auth_rate_limit\(text, bigint, integer\)\s+from public, authenticated/i
  )
  assert.match(
    hardeningMigration,
    /grant execute on function public\.nexus_consume_auth_rate_limit\(text, bigint, integer\)\s+to anon/i
  )
})

test('auth rate-limit storage remains RLS protected and only the internal role receives table grants', () => {
  assert.match(initialMigration, /alter table private\.nexus_auth_rate_limits enable row level security/i)
  assert.match(
    initialMigration,
    /revoke all on table private\.nexus_auth_rate_limits from public, anon, authenticated/i
  )
  assert.match(
    hardeningMigration,
    /grant select, insert, update, delete\s+on table private\.nexus_auth_rate_limits\s+to anon/i
  )
  assert.match(
    hardeningMigration,
    /create policy nexus_server_access\s+on private\.nexus_auth_rate_limits\s+for all\s+to anon/i
  )
  assert.match(
    hardeningMigration,
    /using \(private\.nexus_server_request_authorized\(\)\)\s+with check \(private\.nexus_server_request_authorized\(\)\)/i
  )
})

test('auth rate-limit invoker policy depends on the existing private server-secret validator', () => {
  assert.match(
    hardeningMigration,
    /grant usage on schema private to anon/i
  )
  assert.match(
    hardeningMigration,
    /grant execute on function private\.nexus_server_request_authorized\(\) to anon/i
  )
  assert.match(initialMigration, /private\.nexus_server_request_authorized\(\)/i)
  assert.match(initialMigration, /if not private\.nexus_server_request_authorized\(\) then/i)
})
