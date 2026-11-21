const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const migration = readFileSync(
  join(__dirname, '../sql/065_fix_refresh_token_issue_lock_order.sql'),
  'utf8'
)
const accountDeletionMigration = readFileSync(
  join(__dirname, '../sql/061_refresh_tokens_physical_deletion.sql'),
  'utf8'
)

test('refresh-token issuance cleans expired token rows before locking the account', () => {
  const functionStart = migration.indexOf('create or replace function public.nexus_issue_refresh_token')
  assert.notEqual(functionStart, -1)
  const issueFunction = migration.slice(functionStart)
  const validationIndex = issueFunction.indexOf('p_now_ms is null')
  const previousTokenLockIndex = issueFunction.indexOf('for update')
  const rotationBranchEnd = issueFunction.indexOf(String.fromCharCode(10) + '  end if;', previousTokenLockIndex)
  const cleanupIndex = issueFunction.indexOf('delete from public.refresh_tokens')
  const accountLockIndex = issueFunction.indexOf('for share')

  assert.ok(validationIndex >= 0, 'validate the timestamp before cleanup')
  assert.ok(previousTokenLockIndex > validationIndex, 'lock the previous token only after validating inputs')
  assert.ok(rotationBranchEnd > previousTokenLockIndex, 'finish optional rotation-token locking')
  assert.ok(cleanupIndex > rotationBranchEnd, 'clean up expired rows outside the optional-rotation branch')
  assert.ok(accountLockIndex > cleanupIndex, 'acquire the account lock after all token-row cleanup')
})

test('account deletion revokes refresh tokens before locking the account row', () => {
  const functionStart = accountDeletionMigration.indexOf('create or replace function public.nexus_delete_account')
  assert.notEqual(functionStart, -1)
  const deleteFunction = accountDeletionMigration.slice(functionStart)
  const tokenDeleteIndex = deleteFunction.indexOf('delete from public.refresh_tokens')
  const accountUpdateIndex = deleteFunction.indexOf('update public.accounts')

  assert.ok(tokenDeleteIndex >= 0)
  assert.ok(accountUpdateIndex > tokenDeleteIndex)
})


const concurrencyMigration = readFileSync(
  join(__dirname, '../sql/070_prevent_refresh_cleanup_deadlocks.sql'),
  'utf8'
)

test('expired-token cleanup skips rows locked by concurrent account deletion', () => {
  const functionStart = concurrencyMigration.indexOf(
    'create or replace function public.nexus_issue_refresh_token'
  )
  assert.notEqual(functionStart, -1)
  const issueFunction = concurrencyMigration.slice(functionStart).toLowerCase()
  const previousTokenLockIndex = issueFunction.indexOf('for update;')
  const cleanupStart = issueFunction.indexOf(
    'with expired_token_ids as materialized'
  )
  const skipLockedIndex = issueFunction.indexOf('for update skip locked', cleanupStart)
  const cleanupDeleteIndex = issueFunction.indexOf(
    'delete from public.refresh_tokens token'
  )
  const accountLockIndex = issueFunction.indexOf('for share', cleanupDeleteIndex)

  assert.ok(previousTokenLockIndex >= 0, 'lock the presented refresh token first')
  assert.ok(cleanupStart > previousTokenLockIndex, 'run expiration cleanup after validating the presented token')
  assert.ok(skipLockedIndex > cleanupStart, 'never wait on rows held by account deletion or another cleanup')
  assert.ok(cleanupDeleteIndex > skipLockedIndex, 'delete only rows successfully claimed by the SKIP LOCKED CTE')
  assert.ok(accountLockIndex > cleanupDeleteIndex, 'acquire the account lock after token-row maintenance')
  assert.match(issueFunction, /order by token\.id\s+for update skip locked/)
  assert.doesNotMatch(
    issueFunction,
    /delete from public\.refresh_tokens\s+where expires_at_ms <= p_now_ms/
  )
  assert.match(
    issueFunction,
    /revoke all on function public\.nexus_issue_refresh_token[\s\S]*from public, authenticated/
  )
  assert.match(
    issueFunction,
    /grant execute on function public\.nexus_issue_refresh_token[\s\S]*to anon/
  )
})
