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
